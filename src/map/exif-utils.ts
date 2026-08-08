import fs from "node:fs";
import path from "node:path";
import type { MapPhotoMarker } from "./types";

/**
 * 从JPEG文件中提取GPS坐标信息
 * 返回 null 表示没有GPS数据或解析失败
 */
export function extractGPSFromJPEG(filePath: string): { lat: number; lng: number } | null {
	try {
		const buffer = fs.readFileSync(filePath);

		if (buffer.length < 2 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
			return null;
		}

		let offset = 2;
		let gpsData: {
			latitude: [number, number, number];
			latitudeRef: string;
			longitude: [number, number, number];
			longitudeRef: string;
		} | null = null;

		while (offset < buffer.length) {
			if (offset + 4 > buffer.length) break;

			const marker = buffer[offset];
			offset++;

			if (marker !== 0xff) break;

			const markerType = buffer[offset];
			offset++;

			if (markerType === 0xd9 || markerType === 0xda) {
				break;
			}

			if (offset + 2 > buffer.length) break;

			const length = buffer.readUInt16BE(offset);
			offset += 2;

			if (markerType === 0xe1) {
				const app1Data = buffer.subarray(offset, offset + length - 2);
				gpsData = parseEXIFSegment(app1Data);
				break;
			}

			offset += length - 2;
		}

		if (!gpsData) return null;

		const lat = dmsToDecimal(
			gpsData.latitude[0],
			gpsData.latitude[1],
			gpsData.latitude[2],
			gpsData.latitudeRef === "S"
		);
		const lng = dmsToDecimal(
			gpsData.longitude[0],
			gpsData.longitude[1],
			gpsData.longitude[2],
			gpsData.longitudeRef === "W"
		);

		return { lat, lng };
	} catch {
		return null;
	}
}

/**
 * 解析EXIF段数据，提取GPS信息
 */
function parseEXIFSegment(data: Buffer): {
	latitude: [number, number, number];
	latitudeRef: string;
	longitude: [number, number, number];
	longitudeRef: string;
} | null {
	if (data.length < 6) return null;

	const exifId = data.toString("ascii", 0, 4);
	if (exifId !== "Exif") return null;

	const tiffOffset = 6;
	if (tiffOffset + 8 > data.length) return null;

	const byteOrder = data.toString("ascii", tiffOffset, tiffOffset + 2);
	const isLittleEndian = byteOrder === "II";

	const readUInt32 = (offset: number) =>
		isLittleEndian
			? data.readUInt32LE(offset)
			: data.readUInt32BE(offset);

	const firstIFDOffset = readUInt32(tiffOffset + 4);

	if (firstIFDOffset < 2 || firstIFDOffset + 2 > data.length) return null;

	const gpsIFDEntryOffset = findGPSIFD(data, tiffOffset, firstIFDOffset, isLittleEndian);

	if (gpsIFDEntryOffset === null) return null;

	return parseGPSIFD(data, tiffOffset, gpsIFDEntryOffset, isLittleEndian);
}

/**
 * 查找GPS IFD的偏移量
 */
function findGPSIFD(
	data: Buffer,
	tiffOffset: number,
	firstIFDOffset: number,
	isLittleEndian: boolean
): number | null {
	const readUInt16 = (offset: number) =>
		isLittleEndian ? data.readUInt16LE(offset) : data.readUInt16BE(offset);
	const readUInt32 = (offset: number) =>
		isLittleEndian ? data.readUInt32LE(offset) : data.readUInt32BE(offset);

	let ifdOffset = tiffOffset + firstIFDOffset;
	let entriesRead = 0;

	while (entriesRead < 3) {
		if (ifdOffset + 2 > data.length) return null;

		const numEntries = readUInt16(ifdOffset);
		let entryOffset = ifdOffset + 2;

		for (let i = 0; i < numEntries; i++) {
			if (entryOffset + 12 > data.length) return null;

			const tag = readUInt16(entryOffset);
			const type = readUInt16(entryOffset + 2);
			const count = readUInt32(entryOffset + 4);

			if (tag === 0x8825) {
				let gpsOffset: number;
				if (type === 3 && count === 1) {
					gpsOffset = tiffOffset + readUInt16(entryOffset + 8);
				} else {
					gpsOffset = tiffOffset + readUInt32(entryOffset + 8);
				}
				return gpsOffset;
			}

			entryOffset += 12;
		}

		if (ifdOffset + 2 + numEntries * 12 + 4 > data.length) break;
		ifdOffset = tiffOffset + readUInt32(ifdOffset + 2 + numEntries * 12);
		entriesRead++;
	}

	return null;
}

/**
 * 解析GPS IFD数据
 */
function parseGPSIFD(
	data: Buffer,
	tiffOffset: number,
	gpsIFDOffset: number,
	isLittleEndian: boolean
): {
	latitude: [number, number, number];
	latitudeRef: string;
	longitude: [number, number, number];
	longitudeRef: string;
} | null {
	const readUInt16 = (offset: number) =>
		isLittleEndian ? data.readUInt16LE(offset) : data.readUInt16BE(offset);
	const readUInt32 = (offset: number) =>
		isLittleEndian ? data.readUInt32LE(offset) : data.readUInt32BE(offset);

	if (gpsIFDOffset + 2 > data.length) return null;

	const numEntries = readUInt16(gpsIFDOffset);
	let latRef: string = "N";
	let lat: [number, number, number] = [0, 0, 0];
	let lngRef: string = "E";
	let lng: [number, number, number] = [0, 0, 0];

	let entryOffset = gpsIFDOffset + 2;

	for (let i = 0; i < numEntries; i++) {
		if (entryOffset + 12 > data.length) break;

		const tag = readUInt16(entryOffset);
		const type = readUInt16(entryOffset + 2);
		const count = readUInt32(entryOffset + 4);

		if (tag === 0x0001 && type === 7 && count >= 2) {
			latRef = String.fromCharCode(data[entryOffset + 8]);
		} else if (tag === 0x0002 && type === 5 && count === 3) {
			// RATIONAL data (24 bytes) doesn't fit in 4-byte value field,
			// so entryOffset+8 contains an offset relative to tiffOffset
			const valueOffset = readUInt32(entryOffset + 8);
			lat = readRational3(data, tiffOffset + valueOffset, isLittleEndian);
		} else if (tag === 0x0003 && type === 7 && count >= 2) {
			lngRef = String.fromCharCode(data[entryOffset + 8]);
		} else if (tag === 0x0004 && type === 5 && count === 3) {
			const valueOffset = readUInt32(entryOffset + 8);
			lng = readRational3(data, tiffOffset + valueOffset, isLittleEndian);
		}

		entryOffset += 12;
	}

	return { latitude: lat, latitudeRef: latRef, longitude: lng, longitudeRef: lngRef };
}

/**
 * 读取三个RATIONAL类型的值（每个RATIONAL为8字节：分子+分母）
 */
function readRational3(
	data: Buffer,
	offset: number,
	isLittleEndian: boolean
): [number, number, number] {
	const readUInt32 = (o: number) =>
		isLittleEndian ? data.readUInt32LE(o) : data.readUInt32BE(o);

	// 3 RATIONAL values = 3 × 8 bytes = 24 bytes
	if (offset + 24 <= data.length) {
		const degNum = readUInt32(offset);
		const degDen = readUInt32(offset + 4);
		const minNum = readUInt32(offset + 8);
		const minDen = readUInt32(offset + 12);
		const secNum = readUInt32(offset + 16);
		const secDen = readUInt32(offset + 20);

		return [
			degDen !== 0 ? degNum / degDen : 0,
			minDen !== 0 ? minNum / minDen : 0,
			secDen !== 0 ? secNum / secDen : 0,
		];
	}

	return [0, 0, 0];
}

/**
 * 将度分秒格式转换为十进制
 */
function dmsToDecimal(
	degrees: number,
	minutes: number,
	seconds: number,
	isNegative: boolean
): number {
	let result = Math.abs(degrees) + minutes / 60 + seconds / 3600;
	if (isNegative) result = -result;
	return Math.round(result * 1000000) / 1000000;
}

/**
 * 从相册照片中扫描所有GPS坐标，生成地图标记点
 */
export function scanGalleryPhotosForGPS(
	albums: Array<{ id: string; name: string; photos: string[] }>
): MapPhotoMarker[] {
	const markers: MapPhotoMarker[] = [];
	const cwd = process.cwd();

	for (const album of albums) {
		for (const photoUrl of album.photos) {
			const filePath = path.join(
				cwd,
				"public",
				photoUrl.replace(/^\//, "")
			);

			if (!fs.existsSync(filePath)) continue;

			const gps = extractGPSFromJPEG(filePath);
			if (!gps) continue;

			const marker: MapPhotoMarker = {
				id: `${album.id}-${path.basename(photoUrl)}`,
				src: photoUrl,
				thumbnail: photoUrl,
				width: 0,
				height: 0,
				lat: gps.lat,
				lng: gps.lng,
				caption: album.name,
			};

			markers.push(marker);
		}
	}

	return markers;
}