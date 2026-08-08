import { MAP_WIDTH, MAP_HEIGHT, LNG_MIN, LNG_MAX, LAT_MIN, LAT_MAX } from "./config";
import { PROVINCES } from "./china-provinces";
import type { MapPhotoMarker, MapProvince } from "./types";

/**
 * 将经纬度坐标转换为SVG坐标（等距圆柱投影）
 */
export function projectLngLat(lng: number, lat: number): { x: number; y: number } {
	const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_WIDTH;
	const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_HEIGHT;
	return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

/**
 * 将SVG坐标反投影回经纬度
 */
export function unprojectXY(x: number, y: number): { lng: number; lat: number } {
	const lng = (x / MAP_WIDTH) * (LNG_MAX - LNG_MIN) + LNG_MIN;
	const lat = LAT_MAX - (y / MAP_HEIGHT) * (LAT_MAX - LAT_MIN);
	return { lng: Math.round(lng * 1000) / 1000, lat: Math.round(lat * 1000) / 1000 };
}

/**
 * 使用Haversine公式计算两个经纬度点之间的距离（单位：公里）
 */
export function haversineDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * 解析SVG路径数据，提取多边形顶点列表
 * 每个子路径（由 M...Z 定义）作为一个独立多边形
 */
function parseSvgPathToPolygons(pathData: string): Array<Array<{ x: number; y: number }>> {
	const polygons: Array<Array<{ x: number; y: number }>> = [];
	const commands = pathData.match(/[MLZmlz][^MLZmlz]*/g);
	if (!commands) return polygons;

	let currentPolygon: Array<{ x: number; y: number }> = [];
	let lastX = 0;
	let lastY = 0;

	for (const cmd of commands) {
		const type = cmd[0];
		const coords = cmd
			.slice(1)
			.trim()
			.split(/[\s,]+/)
			.filter((s) => s.length > 0)
			.map(Number);

		if (type === "M" || type === "L") {
			for (let i = 0; i < coords.length; i += 2) {
				const x = coords[i];
				const y = coords[i + 1];
				currentPolygon.push({ x, y });
				lastX = x;
				lastY = y;
			}
		} else if (type === "m" || type === "l") {
			for (let i = 0; i < coords.length; i += 2) {
				lastX += coords[i];
				lastY += coords[i + 1];
				currentPolygon.push({ x: lastX, y: lastY });
			}
		} else if (type === "Z" || type === "z") {
			if (currentPolygon.length >= 3) {
				polygons.push(currentPolygon);
			}
			currentPolygon = [];
		}
	}

	return polygons;
}

/**
 * 射线法判断点是否在多边形内部
 */
function isPointInPolygon(
	px: number,
	py: number,
	polygon: Array<{ x: number; y: number }>
): boolean {
	let inside = false;
	const n = polygon.length;

	for (let i = 0, j = n - 1; i < n; j = i++) {
		const xi = polygon[i].x;
		const yi = polygon[i].y;
		const xj = polygon[j].x;
		const yj = polygon[j].y;

		if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}

	return inside;
}

/**
 * 根据经纬度查找所在省份
 * 优先使用点在多边形内检测，若不在任何省份多边形内则回退到最近中心点
 */
export function findNearestProvince(lat: number, lng: number): MapProvince | null {
	const { x, y } = projectLngLat(lng, lat);

	// 优先：点在多边形内检测
	for (const province of PROVINCES) {
		const polygons = parseSvgPathToPolygons(province.path);
		for (const polygon of polygons) {
			if (isPointInPolygon(x, y, polygon)) {
				return province;
			}
		}
	}

	// 回退：最近中心点
	let nearest: MapProvince | null = null;
	let minDist = Infinity;

	for (const province of PROVINCES) {
		const dist = haversineDistance(lat, lng, province.center.lat, province.center.lng);
		if (dist < minDist) {
			minDist = dist;
			nearest = province;
		}
	}

	return nearest;
}

/**
 * 计算两个标记点之间的SVG像素距离
 */
export function pixelDistance(
	x1: number,
	y1: number,
	x2: number,
	y2: number
): number {
	return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * 将照片标记点按省份分组
 */
export function groupMarkersByProvince(
	markers: MapPhotoMarker[]
): Map<string, MapPhotoMarker[]> {
	const groups: Map<string, MapPhotoMarker[]> = new Map();

	for (const marker of markers) {
		const key = marker.provinceId || "unknown";
		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key)!.push(marker);
	}

	return groups;
}

/**
 * 为标记点添加省份信息
 */
export function enrichMarkersWithProvince(
	markers: MapPhotoMarker[]
): MapPhotoMarker[] {
	return markers.map((marker) => {
		if (marker.provinceId) return marker;

		const province = findNearestProvince(marker.lat, marker.lng);
		return {
			...marker,
			provinceId: province?.id,
		};
	});
}

/**
 * 计算聚类引脚的位置（当多个标记点靠得很近时）
 */
export function computeClusterPosition(markers: MapPhotoMarker[]): { x: number; y: number } {
	let sumX = 0;
	let sumY = 0;

	for (const marker of markers) {
		const pos = projectLngLat(marker.lng, marker.lat);
		sumX += pos.x;
		sumY += pos.y;
	}

	return {
		x: Math.round((sumX / markers.length) * 100) / 100,
		y: Math.round((sumY / markers.length) * 100) / 100,
	};
}

/**
 * 检测并处理标记点重叠，返回调整后的标记点位置列表
 */
export function resolveMarkerOverlaps(
	markers: MapPhotoMarker[],
	minDistance: number = 30
): MapPhotoMarker[] {
	const positions = markers.map((m) => {
		const pos = projectLngLat(m.lng, m.lat);
		return { ...m, svgX: pos.x, svgY: pos.y };
	});

	const result = [...positions];

	for (let i = 0; i < result.length; i++) {
		for (let j = i + 1; j < result.length; j++) {
			const a = result[i];
			const b = result[j];
			const dist = pixelDistance(a.svgX, a.svgY, b.svgX, b.svgY);

			if (dist < minDistance && dist > 0) {
				const overlap = minDistance - dist;
				const dx = (b.svgX - a.svgX) / dist;
				const dy = (b.svgY - a.svgY) / dist;

				b.svgX += (dx * overlap) / 2;
				b.svgY += (dy * overlap) / 2;
				a.svgX -= (dx * overlap) / 2;
				a.svgY -= (dy * overlap) / 2;
			}
		}
	}

	return result.map(({ svgX, svgY, ...m }) => ({
		...m,
		...unprojectXY(svgX, svgY),
	}));
}