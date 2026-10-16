export type OptionChoice = {
  name: string;
  price: number;
  isBase?: boolean;
};

export type OptionGroup = {
  name: string;
  required: boolean;
  maxPick?: number;
  choices: OptionChoice[];
};

export type ProductMetadata = {
  cleanDescription: string;
  calories: number | null;
  spiceLevel: string | null;
  nutritionTags: string[];
  allergens: string | null;
  course: string | null;
  searchKeywords: string | null;
  customization: string | null;
  optionGroups: OptionGroup[];
  dietType: "veg" | "non-veg" | "egg";
};

/**
 * Parses embedded tags and structured metadata from a product description string.
 * Supports [cal:380], [spice:Medium], [nutrition:...], [allergens:...],
 * [course:...], [tags:...], [custom:...], [egg].
 */
export function parseProductMetadata(
  description: string | null | undefined,
  isVegetarian: boolean
): ProductMetadata {
  const desc = description || "";

  // 1. Calories (supports [cal:380] or inline "380 kcal" / "Calories: 380")
  const calMatch =
    desc.match(/\[cal:(\d+)\]/i) ||
    desc.match(/(?:cal(?:ories)?|kcal)[:\s]*(\d+)/i);
  const calories = calMatch ? parseInt(calMatch[1], 10) : null;

  // 2. Spice Level (e.g. [spice:Medium] or [spice:Hot])
  const spiceMatch = desc.match(/\[spice:([^\]]+)\]/i);
  const spiceLevel = spiceMatch ? spiceMatch[1].trim() : null;

  // 3. Nutrition Tags (e.g. [nutrition:High protein; Fried / crispy])
  const nutritionMatch = desc.match(/\[nutrition:([^\]]+)\]/i);
  const nutritionTags = nutritionMatch
    ? nutritionMatch[1]
        .split(/[;,]/)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // 4. Allergens / Contains (e.g. [allergens:nuts] or [contains:dairy, gluten])
  const allergensMatch =
    desc.match(/\[allergens:([^\]]+)\]/i) ||
    desc.match(/\[contains:([^\]]+)\]/i);
  let parsedAllergens = allergensMatch ? allergensMatch[1].trim() : null;
  if (
    parsedAllergens &&
    /^(none|none\s+listed|none-listed|no|n\/a|na|nil|nothing|-)$/i.test(
      parsedAllergens
    )
  ) {
    parsedAllergens = null;
  }
  const allergens = parsedAllergens;

  // 5. Course (e.g. [course:Starter] or [course:Main Course])
  const courseMatch = desc.match(/\[course:([^\]]+)\]/i);
  const course = courseMatch ? courseMatch[1].trim() : null;

  // 6. Search Keywords (e.g. [tags:non-veg, spicy, kids friendly])
  const tagsMatch =
    desc.match(/\[tags:([^\]]+)\]/i) ||
    desc.match(/\[keywords:([^\]]+)\]/i);
  const searchKeywords = tagsMatch ? tagsMatch[1].trim() : null;

  // 7. Customization / Order sizes (e.g. [custom:No options: order as listed])
  const customMatch = desc.match(/\[custom:([^\]]+)\]/i);
  const customization = customMatch ? customMatch[1].trim() : null;

  // 8. Option Groups / Customizations
  // e.g. [options:[{"name":"Choice","required":true,"maxPick":1,"choices":[{"name":"Egg","price":1}]}]]
  const optionsMatch = desc.match(/\[options:(\[.+?\])\]/);
  let optionGroups: OptionGroup[] = [];
  if (optionsMatch) {
    try {
      const parsed = JSON.parse(optionsMatch[1]);
      if (Array.isArray(parsed)) {
        optionGroups = parsed;
      }
    } catch {
      // ignore
    }
  }

  // 9. Diet Type (Egg, Veg, Non-Veg)
  const hasEggTag = /\[egg\]/i.test(desc);
  let dietType: "veg" | "non-veg" | "egg" = isVegetarian ? "veg" : "non-veg";
  if (hasEggTag) {
    dietType = "egg";
  }

  // 10. Clean Human-Readable Description (all metadata tags removed)
  const cleanDescription = desc
    .replace(/\[cal:\d+\]\s*/gi, "")
    .replace(/\[spice:[^\]]+\]\s*/gi, "")
    .replace(/\[nutrition:[^\]]+\]\s*/gi, "")
    .replace(/\[allergens:[^\]]+\]\s*/gi, "")
    .replace(/\[contains:[^\]]+\]\s*/gi, "")
    .replace(/\[course:[^\]]+\]\s*/gi, "")
    .replace(/\[tags:[^\]]+\]\s*/gi, "")
    .replace(/\[keywords:[^\]]+\]\s*/gi, "")
    .replace(/\[custom:[^\]]+\]\s*/gi, "")
    .replace(/\[options:\[.+?\]\]\s*/gi, "")
    .replace(/\[egg\]\s*/gi, "")
    .trim();

  return {
    cleanDescription,
    calories,
    spiceLevel,
    nutritionTags,
    allergens,
    course,
    searchKeywords,
    customization,
    optionGroups,
    dietType,
  };
}

/**
 * Encodes structured metadata fields into the product description for storage.
 */
export function buildProductDescription({
  description,
  calories,
  spiceLevel,
  nutritionTags,
  allergens,
  course,
  searchKeywords,
  customization,
  optionGroups,
  dietType,
}: {
  description: string;
  calories?: string | number | null;
  spiceLevel?: string | null;
  nutritionTags?: string | string[] | null;
  allergens?: string | null;
  course?: string | null;
  searchKeywords?: string | null;
  customization?: string | null;
  optionGroups?: OptionGroup[] | null;
  dietType?: "VEG" | "NON_VEG" | "EGG" | "veg" | "non-veg" | "egg";
}): string {
  let tags = "";

  if (dietType === "EGG" || dietType === "egg") {
    tags += "[egg] ";
  }

  if (calories) {
    const calNum =
      typeof calories === "number"
        ? calories
        : parseInt(String(calories).replace(/\D/g, ""), 10);
    if (calNum && Number.isFinite(calNum)) {
      tags += `[cal:${calNum}] `;
    }
  }

  if (
    spiceLevel &&
    spiceLevel.trim() &&
    spiceLevel.trim().toLowerCase() !== "none"
  ) {
    tags += `[spice:${spiceLevel.trim()}] `;
  }

  if (nutritionTags) {
    const nutStr = Array.isArray(nutritionTags)
      ? nutritionTags.join("; ")
      : String(nutritionTags).trim();
    if (nutStr) {
      tags += `[nutrition:${nutStr}] `;
    }
  }

  if (allergens && allergens.trim()) {
    const trimmed = allergens.trim();
    if (
      !/^(none|none\s+listed|none-listed|no|n\/a|na|nil|nothing|-)$/i.test(
        trimmed
      )
    ) {
      tags += `[allergens:${trimmed}] `;
    }
  }

  if (course && course.trim()) {
    tags += `[course:${course.trim()}] `;
  }

  if (searchKeywords && searchKeywords.trim()) {
    tags += `[tags:${searchKeywords.trim()}] `;
  }

  if (customization && customization.trim()) {
    tags += `[custom:${customization.trim()}] `;
  }

  if (optionGroups && optionGroups.length > 0) {
    try {
      tags += `[options:${JSON.stringify(optionGroups)}] `;
    } catch {}
  }

  // Strip any old embedded tags from the raw description to prevent duplication
  const clean = description
    .replace(/\[cal:\d+\]\s*/gi, "")
    .replace(/\[spice:[^\]]+\]\s*/gi, "")
    .replace(/\[nutrition:[^\]]+\]\s*/gi, "")
    .replace(/\[allergens:[^\]]+\]\s*/gi, "")
    .replace(/\[contains:[^\]]+\]\s*/gi, "")
    .replace(/\[course:[^\]]+\]\s*/gi, "")
    .replace(/\[tags:[^\]]+\]\s*/gi, "")
    .replace(/\[keywords:[^\]]+\]\s*/gi, "")
    .replace(/\[custom:[^\]]+\]\s*/gi, "")
    .replace(/\[options:\[.+?\]\]\s*/gi, "")
    .replace(/\[egg\]\s*/gi, "")
    .trim();

  return `${tags}${clean}`.trim();
}
