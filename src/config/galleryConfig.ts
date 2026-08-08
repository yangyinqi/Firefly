import type { GalleryConfig } from "@/types/config";

// 相册配置
export const galleryConfig: GalleryConfig = {
	// 相册列表
	albums: [
		// 支持jpg/png/webp/avif/gif格式
		// id: 相册唯一标识符（用于目录命名和URL路径），比如设置：id: "firefly-2026", 对应 public/gallery/firefly-2026/目录
		// cover: 手动指定封面图（可选，不填会把cover.*文件作为封面图，如果没有cover.*文件，则使用第一张图片作为封面图）
		// name: 相册名称
		// description: 相册描述
		// location: 相册拍摄地点
		// date: 相册日期，格式为 YYYY-MM-DD，用于排序和显示
		// tags: 相册标签，用于分类和过滤
		// 每添加一个数组项就相当于添加了一个相册，记得在 public/gallery/ 目录下创建对应的子目录并放入图片
		{
			id: "firefly-2026",
			name: "可爱流萤",
			description: "飞萤之火自无梦的长夜亮起，绽放在终竟的明天。",
			location: "崩坏：星穹铁道",
			date: "2026-01-01",
			tags: ["崩坏星穹铁道", "流萤"],
		},
		{
			id: "fujian",
			name: "福建",
			description: "拍摄于福州熊猫世界",
			location: "福建-福州",
			date: "2026-04-28",
			tags: ["旅行", "福建"],
		},
		{
			id: "wutaishan",
			name: "五台山",
			description: "拍摄于山西省忻州市五台山",
			location: "山西-忻州",
			date: "2026-05-27",
			tags: ["旅行", "山西"],
		},
		{
			id: "hangpai",
			name: "航拍汇总",
			description: "航拍汇总",
			location: "DJI-AIR3",
			date: "2026-08-03",
			tags: ["旅行", "航拍"],
		},
		{
			id: "yunnan",
			name: "玉龙雪山",
			description: "玉龙雪山4680平台",
			location: "云南-丽江",
			date: "2024-10-18",
			tags: ["旅行", "云南"],
		},
		{
			id: "shanghai",
			name: "上海",
			description: "上海外滩",
			location: "上海外滩",
			date: "2023-01-21",
			tags: ["旅行", "上海"],
		},
	],

	// 瀑布流最小列宽(px)，浏览器根据容器宽度自动计算列数，默认 240
	// 值越小列数越多，值越大列数越少
	columnWidth: 240,
};
