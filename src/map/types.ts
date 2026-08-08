export interface MapPhotoMarker {
	id: string;
	src: string;
	thumbnail: string;
	width: number;
	height: number;
	lat: number;
	lng: number;
	provinceId?: string;
	caption?: string;
	date?: string;
}

export interface MapProvince {
	id: string;
	name: string;
	aliases: string[];
	center: { lat: number; lng: number };
	path: string;
	labelX: number;
	labelY: number;
	labelFontSize?: number;
}

export interface MapProvinceHighlight {
	provinceId: string;
	count: number;
	photos: MapPhotoMarker[];
}
