import fs from "node:fs";
import path from "node:path";

const GEOJSON_PATH = path.join(process.cwd(), "scripts", "china-geo.json");
const OUTPUT_PATH = path.join(process.cwd(), "src", "map", "china-provinces.ts");

const SVG_W = 1000;
const SVG_H = 750;
const LNG_MIN = 73;
const LNG_MAX = 136;
const LAT_MIN = 17;
const LAT_MAX = 54;

const NAME_MAP = {
	"北京市": "beijing",
	"天津市": "tianjin",
	"河北省": "hebei",
	"山西省": "shanxi",
	"内蒙古自治区": "neimenggu",
	"辽宁省": "liaoning",
	"吉林省": "jilin",
	"黑龙江省": "heilongjiang",
	"上海市": "shanghai",
	"江苏省": "jiangsu",
	"浙江省": "zhejiang",
	"安徽省": "anhui",
	"福建省": "fujian",
	"江西省": "jiangxi",
	"山东省": "shandong",
	"河南省": "henan",
	"湖北省": "hubei",
	"湖南省": "hunan",
	"广东省": "guangdong",
	"广西壮族自治区": "guangxi",
	"海南省": "hainan",
	"重庆市": "chongqing",
	"四川省": "sichuan",
	"贵州省": "guizhou",
	"云南省": "yunnan",
	"西藏自治区": "xizang",
	"陕西省": "shaanxi",
	"甘肃省": "gansu",
	"青海省": "qinghai",
	"宁夏回族自治区": "ningxia",
	"新疆维吾尔自治区": "xinjiang",
	"台湾省": "taiwan",
	"香港特别行政区": "xianggang",
	"澳门特别行政区": "aomen",
};

const PROVINCE_CENTERS = {
	heilongjiang: { lat: 47.5, lng: 128.0 },
	jilin: { lat: 43.5, lng: 126.5 },
	liaoning: { lat: 41.8, lng: 123.4 },
	neimenggu: { lat: 40.84, lng: 111.75 },
	xinjiang: { lat: 43.82, lng: 87.62 },
	xizang: { lat: 29.65, lng: 91.11 },
	qinghai: { lat: 36.62, lng: 101.78 },
	gansu: { lat: 36.06, lng: 103.83 },
	ningxia: { lat: 38.48, lng: 106.23 },
	shanxi: { lat: 37.87, lng: 112.56 },
	shaanxi: { lat: 34.34, lng: 108.94 },
	hebei: { lat: 38.04, lng: 114.51 },
	beijing: { lat: 39.9, lng: 116.4 },
	tianjin: { lat: 39.13, lng: 117.2 },
	shandong: { lat: 36.65, lng: 117.2 },
	henan: { lat: 34.76, lng: 113.65 },
	jiangsu: { lat: 32.06, lng: 118.8 },
	shanghai: { lat: 31.23, lng: 121.47 },
	anhui: { lat: 31.86, lng: 117.28 },
	hubei: { lat: 30.59, lng: 114.3 },
	sichuan: { lat: 30.57, lng: 104.07 },
	chongqing: { lat: 29.56, lng: 106.55 },
	zhejiang: { lat: 29.2, lng: 120.15 },
	jiangxi: { lat: 27.62, lng: 115.89 },
	hunan: { lat: 28.23, lng: 112.94 },
	guizhou: { lat: 26.65, lng: 106.71 },
	yunnan: { lat: 25.04, lng: 102.68 },
	guangxi: { lat: 22.81, lng: 108.37 },
	guangdong: { lat: 23.13, lng: 113.26 },
	fujian: { lat: 26.08, lng: 119.3 },
	hainan: { lat: 20.04, lng: 110.2 },
	taiwan: { lat: 25.03, lng: 121.5 },
	xianggang: { lat: 22.32, lng: 114.17 },
	aomen: { lat: 22.2, lng: 113.55 },
};

function projectLngLat(lng, lat) {
	const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * SVG_W;
	const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * SVG_H;
	return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

function simplifyRing(ring, tolerance) {
	if (ring.length <= 4) return ring;
	const result = [ring[0]];
	for (let i = 1; i < ring.length; i++) {
		const last = result[result.length - 1];
		const dx = ring[i][0] - last[0];
		const dy = ring[i][1] - last[1];
		if (Math.sqrt(dx * dx + dy * dy) >= tolerance || i === ring.length - 1) {
			result.push(ring[i]);
		}
	}
	if (result.length > 1 && (result[0][0] !== result[result.length - 1][0] || result[0][1] !== result[result.length - 1][1])) {
		result.push(result[0]);
	}
	return result;
}

function ringToPathD(ring) {
	const simplified = simplifyRing(ring, 0.03);
	if (simplified.length < 3) return "";

	const points = simplified.map(([lng, lat]) => {
		const { x, y } = projectLngLat(lng, lat);
		return `${x.toFixed(2)},${y.toFixed(2)}`;
	});

	if (points.length > 2 && points[0] === points[points.length - 1]) {
		points.pop();
	}

	return `M ${points[0]} L ${points.slice(1).join(" L ")} Z`;
}

function computeLabelPosition(geometry) {
	let outerRings = [];
	if (geometry.type === "Polygon") {
		outerRings = [geometry.coordinates[0]];
	} else if (geometry.type === "MultiPolygon") {
		for (const polygon of geometry.coordinates) {
			if (polygon.length > 0) {
				outerRings.push(polygon[0]);
			}
		}
	}

	let totalArea = 0;
	let cx = 0;
	let cy = 0;

	for (const ring of outerRings) {
		const projected = ring.map(([lng, lat]) => projectLngLat(lng, lat));
		let crossSum = 0;
		let ringCx = 0;
		let ringCy = 0;
		for (let i = 0; i < projected.length - 1; i++) {
			const x0 = projected[i].x;
			const y0 = projected[i].y;
			const x1 = projected[i + 1].x;
			const y1 = projected[i + 1].y;
			const cross = x0 * y1 - x1 * y0;
			crossSum += cross;
			ringCx += (x0 + x1) * cross;
			ringCy += (y0 + y1) * cross;
		}
		const signedArea = crossSum / 2;
		if (Math.abs(signedArea) > 0.01) {
			ringCx /= 6 * signedArea;
			ringCy /= 6 * signedArea;
			const absArea = Math.abs(signedArea);
			totalArea += absArea;
			cx += ringCx * absArea;
			cy += ringCy * absArea;
		}
	}

	if (totalArea > 0) {
		cx /= totalArea;
		cy /= totalArea;
		return {
			labelX: Math.round(cx * 100) / 100,
			labelY: Math.round(cy * 100) / 100,
		};
	}

	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (const ring of outerRings) {
		for (const [lng, lat] of ring) {
			const { x, y } = projectLngLat(lng, lat);
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
		}
	}
	return {
		labelX: Math.round(((minX + maxX) / 2) * 100) / 100,
		labelY: Math.round(((minY + maxY) / 2) * 100) / 100,
	};
}

const rawData = JSON.parse(fs.readFileSync(GEOJSON_PATH, "utf-8"));
const features = rawData.features;

const provinces = [];

for (const feature of features) {
	const rawName = feature.properties.name;
	const stdName = NAME_MAP[rawName];
	if (!stdName) {
		console.log(`Unknown province: ${rawName}, skipping`);
		continue;
	}

	const centerData = PROVINCE_CENTERS[stdName];
	if (!centerData) {
		console.log(`No center data for ${stdName}, skipping`);
		continue;
	}

	const geometry = feature.geometry;
	let pathD = "";

	if (geometry.type === "Polygon") {
		pathD = ringToPathD(geometry.coordinates[0]);
	} else if (geometry.type === "MultiPolygon") {
		const parts = [];
		for (const polygon of geometry.coordinates) {
			if (polygon.length > 0) {
				const ringPath = ringToPathD(polygon[0]);
				if (ringPath) parts.push(ringPath);
			}
		}
		pathD = parts.join(" ");
	}

	if (!pathD) {
		console.log(`Failed to generate path for ${stdName}`);
		continue;
	}

	const { labelX, labelY } = computeLabelPosition(geometry);

	provinces.push({
		id: stdName,
		name: stdName,
		aliases: [rawName],
		center: centerData,
		path: pathD,
		labelX,
		labelY,
	});
}

provinces.sort((a, b) => a.id.localeCompare(b.id));

const output = `import type { MapProvince } from "./types";

export const PROVINCES: MapProvince[] = ${JSON.stringify(provinces, null, 2)};

export const PROVINCE_MAP: Record<string, MapProvince> = Object.fromEntries(
	PROVINCES.map((p) => [p.id, p])
);
`;

fs.writeFileSync(OUTPUT_PATH, output, "utf-8");
console.log(`Generated ${OUTPUT_PATH} with ${provinces.length} provinces`);
