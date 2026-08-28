export type OccasionGroup = "Wedding" | "Festival" | "Everyday";

export type Occasion = {
  id: number;
  name: string;
  group: OccasionGroup;
  looks: number;
  swapFrom: number;
  averageWorn: number;
  averageSwap: number;
  peak: string;
  description: string;
  colours: { name: string; value: string }[];
  garments: { name: string; count: number }[];
};

const weddingColours = [{name:"Emerald",value:"#0E5E45"},{name:"Fuchsia",value:"#C2185B"},{name:"Wine",value:"#6E1023"},{name:"Gold",value:"#C9A227"},{name:"Ink blue",value:"#1B3A6B"}];
const festivalColours = [{name:"Marigold",value:"#D28A10"},{name:"Rani",value:"#C2185B"},{name:"Vermilion",value:"#A72A20"},{name:"Leaf",value:"#526B3E"},{name:"Ivory",value:"#F2EDE3"}];
const everydayColours = [{name:"Ivory",value:"#F2EDE3"},{name:"Black",value:"#1C1C1C"},{name:"Denim",value:"#34506F"},{name:"Oatmeal",value:"#DCD2C0"},{name:"Olive",value:"#6B7256"}];

export const occasions: Occasion[] = [
  {id:41,name:"Sangeet",group:"Wedding",looks:58,swapFrom:1850,averageWorn:520000,averageSwap:4890,peak:"Peaks Nov–Feb",description:"The one everyone overthinks. Dress for the dancing first: lighter movement, bold colour, and one statement piece.",colours:weddingColours,garments:[{name:"Lehenga",count:43},{name:"Sharara / gharara",count:6},{name:"Saree",count:7},{name:"Anarkali",count:2}]},
  {id:42,name:"Mehendi",group:"Wedding",looks:44,swapFrom:1420,averageWorn:410000,averageSwap:3620,peak:"Peaks Nov–Feb",description:"Colourful, relaxed and made for a long afternoon. Light fabrics and hands-free accessories matter more here than ceremony-level formality.",colours:weddingColours,garments:[{name:"Sharara",count:18},{name:"Lehenga",count:12},{name:"Kurta set",count:9},{name:"Saree",count:5}]},
  {id:43,name:"Reception",group:"Wedding",looks:37,swapFrom:2890,averageWorn:650000,averageSwap:6180,peak:"Peaks Nov–Feb",description:"The most formal wedding event. Cleaner silhouettes, deeper colour and jewellery that reads clearly after dark dominate the archive.",colours:weddingColours,garments:[{name:"Saree",count:14},{name:"Lehenga",count:12},{name:"Gown",count:8},{name:"Anarkali",count:3}]},
  {id:44,name:"Haldi",group:"Wedding",looks:41,swapFrom:1180,averageWorn:120000,averageSwap:2940,peak:"Peaks Nov–Feb",description:"Bright, breathable and safe around turmeric. Simple shapes win because the colour and flowers do most of the visual work.",colours:festivalColours,garments:[{name:"Kurta set",count:19},{name:"Sharara",count:10},{name:"Saree",count:7},{name:"Lehenga",count:5}]},
  {id:45,name:"Engagement",group:"Wedding",looks:38,swapFrom:2310,averageWorn:450000,averageSwap:5210,peak:"All year",description:"Polished but not reception-heavy. Structured drape, controlled embellishment and one memorable accessory are the repeat pattern.",colours:weddingColours,garments:[{name:"Saree",count:13},{name:"Lehenga",count:11},{name:"Gown",count:9},{name:"Suit",count:5}]},
  {id:46,name:"Diwali",group:"Festival",looks:41,swapFrom:1290,averageWorn:230000,averageSwap:3480,peak:"8 Nov · 72 days",description:"Festive colour and evening shine without bridal weight. The strongest looks balance one worked piece with clean styling.",colours:festivalColours,garments:[{name:"Saree",count:15},{name:"Kurta set",count:12},{name:"Lehenga",count:9},{name:"Sharara",count:5}]},
  {id:47,name:"Navratri",group:"Festival",looks:31,swapFrom:1200,averageWorn:180000,averageSwap:2760,peak:"11 Oct · 44 days",description:"Movement is non-negotiable. Shorter hems, secure dupattas and colour that holds up across a crowded garba floor define this archive.",colours:festivalColours,garments:[{name:"Chaniya choli",count:17},{name:"Lehenga",count:8},{name:"Sharara",count:4},{name:"Saree",count:2}]},
  {id:48,name:"Karwa Chauth",group:"Festival",looks:22,swapFrom:1700,averageWorn:260000,averageSwap:4120,peak:"29 Oct · 62 days",description:"Rich reds and wine shades lead, but modern archives also make room for jewel tones and restrained gold detailing.",colours:festivalColours,garments:[{name:"Saree",count:9},{name:"Suit",count:6},{name:"Lehenga",count:5},{name:"Sharara",count:2}]},
  {id:49,name:"Holi",group:"Festival",looks:26,swapFrom:799,averageWorn:90000,averageSwap:1890,peak:"Peaks March",description:"Wearable, washable and deliberately simple. White cotton, flat shoes and minimal accessories are the practical formula.",colours:festivalColours,garments:[{name:"Kurta",count:14},{name:"Co-ord",count:6},{name:"Saree",count:4},{name:"Dress",count:2}]},
  {id:50,name:"Eid",group:"Festival",looks:17,swapFrom:1499,averageWorn:200000,averageSwap:3340,peak:"Peaks March",description:"Elegant layers, fluid fabric and precise embroidery recur more often than maximal styling in this archive.",colours:festivalColours,garments:[{name:"Anarkali",count:7},{name:"Sharara",count:5},{name:"Kurta set",count:3},{name:"Saree",count:2}]},
  {id:51,name:"Airport",group:"Everyday",looks:142,swapFrom:699,averageWorn:180000,averageSwap:2340,peak:"Most searched",description:"Comfort that still photographs well: relaxed layers, practical bags, flat shoes and repeatable neutral palettes.",colours:everydayColours,garments:[{name:"Co-ord",count:48},{name:"Kurta set",count:39},{name:"Denim",count:34},{name:"Athleisure",count:21}]},
  {id:52,name:"Red carpet",group:"Everyday",looks:91,swapFrom:2499,averageWorn:650000,averageSwap:5720,peak:"Awards season",description:"One silhouette, one focal idea, and tailoring that survives every camera angle. These are the archive's highest-impact swaps.",colours:weddingColours,garments:[{name:"Gown",count:46},{name:"Saree",count:25},{name:"Lehenga",count:12},{name:"Suit",count:8}]},
  {id:53,name:"Promo tour",group:"Everyday",looks:76,swapFrom:999,averageWorn:200000,averageSwap:2890,peak:"All year",description:"Designed for repeated appearances in one day: strong colour, clean shape and pieces that can be restyled between stops.",colours:everydayColours,garments:[{name:"Dress",count:27},{name:"Co-ord",count:23},{name:"Saree",count:15},{name:"Suit",count:11}]},
  {id:54,name:"Casual",group:"Everyday",looks:103,swapFrom:599,averageWorn:100000,averageSwap:1690,peak:"All year",description:"The useful archive: denim, tees, relaxed shirts and everyday shoes that translate directly without costume-level styling.",colours:everydayColours,garments:[{name:"Denim",count:38},{name:"Tee",count:27},{name:"Dress",count:21},{name:"Athleisure",count:17}]},
];

export function occasionSlug(occasion: Occasion) { return occasion.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }
export function getOccasionBySlug(slug: string) { return occasions.find((occasion) => occasionSlug(occasion) === slug); }
