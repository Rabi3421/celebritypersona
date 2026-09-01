/** Seed source for the `occasions` collection. Not read by the app. */
import type { Occasion } from "@/lib/types";

/** Real-world dates drive the "Coming up" countdown; the page calculates the
 *  days remaining rather than storing them. */
const weddingColours = [{name:"Emerald",value:"#0E5E45"},{name:"Fuchsia",value:"#C2185B"},{name:"Wine",value:"#6E1023"},{name:"Gold",value:"#C9A227"},{name:"Ink blue",value:"#1B3A6B"}];
const festivalColours = [{name:"Marigold",value:"#D28A10"},{name:"Rani",value:"#C2185B"},{name:"Vermilion",value:"#A72A20"},{name:"Leaf",value:"#526B3E"},{name:"Ivory",value:"#F2EDE3"}];
const everydayColours = [{name:"Ivory",value:"#F2EDE3"},{name:"Black",value:"#1C1C1C"},{name:"Denim",value:"#34506F"},{name:"Oatmeal",value:"#DCD2C0"},{name:"Olive",value:"#6B7256"}];

export const occasions: Occasion[] = [
  {id:41,name:"Sangeet",nextDate:"2026-11-15",group:"Wedding",peak:"Peaks Nov–Feb",description:"The one everyone overthinks. Dress for the dancing first: lighter movement, bold colour, and one statement piece.",colours:weddingColours},
  {id:42,name:"Mehendi",group:"Wedding",peak:"Peaks Nov–Feb",description:"Colourful, relaxed and made for a long afternoon. Light fabrics and hands-free accessories matter more here than ceremony-level formality.",colours:weddingColours},
  {id:43,name:"Reception",group:"Wedding",peak:"Peaks Nov–Feb",description:"The most formal wedding event. Cleaner silhouettes, deeper colour and jewellery that reads clearly after dark dominate the archive.",colours:weddingColours},
  {id:44,name:"Haldi",group:"Wedding",peak:"Peaks Nov–Feb",description:"Bright, breathable and safe around turmeric. Simple shapes win because the colour and flowers do most of the visual work.",colours:festivalColours},
  {id:45,name:"Engagement",group:"Wedding",peak:"All year",description:"Polished but not reception-heavy. Structured drape, controlled embellishment and one memorable accessory are the repeat pattern.",colours:weddingColours},
  {id:46,name:"Diwali",nextDate:"2026-11-08",group:"Festival",peak:"Peaks November",description:"Festive colour and evening shine without bridal weight. The strongest looks balance one worked piece with clean styling.",colours:festivalColours},
  {id:47,name:"Navratri",nextDate:"2026-10-11",group:"Festival",peak:"Peaks October",description:"Movement is non-negotiable. Shorter hems, secure dupattas and colour that holds up across a crowded garba floor define this archive.",colours:festivalColours},
  {id:48,name:"Karwa Chauth",nextDate:"2026-10-29",group:"Festival",peak:"Peaks October",description:"Rich reds and wine shades lead, but modern archives also make room for jewel tones and restrained gold detailing.",colours:festivalColours},
  {id:49,name:"Holi",group:"Festival",peak:"Peaks March",description:"Wearable, washable and deliberately simple. White cotton, flat shoes and minimal accessories are the practical formula.",colours:festivalColours},
  {id:50,name:"Eid",group:"Festival",peak:"Peaks March",description:"Elegant layers, fluid fabric and precise embroidery recur more often than maximal styling in this archive.",colours:festivalColours},
  {id:51,name:"Airport",group:"Everyday",peak:"Most searched",description:"Comfort that still photographs well: relaxed layers, practical bags, flat shoes and repeatable neutral palettes.",colours:everydayColours},
  {id:52,name:"Red carpet",group:"Everyday",peak:"Awards season",description:"One silhouette, one focal idea, and tailoring that survives every camera angle. These are the archive's highest-impact swaps.",colours:weddingColours},
  {id:53,name:"Promo tour",group:"Everyday",peak:"All year",description:"Designed for repeated appearances in one day: strong colour, clean shape and pieces that can be restyled between stops.",colours:everydayColours},
  {id:54,name:"Casual",group:"Everyday",peak:"All year",description:"The useful archive: denim, tees, relaxed shirts and everyday shoes that translate directly without costume-level styling.",colours:everydayColours},
];

