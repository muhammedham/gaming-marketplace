export type InventoryWeaponGroup = {
  weapon: string;
  skins: string[];
};

const VALORANT_WEAPONS = [
  "Classic",
  "Shorty",
  "Frenzy",
  "Ghost",
  "Sheriff",
  "Stinger",
  "Spectre",
  "Bucky",
  "Judge",
  "Bulldog",
  "Guardian",
  "Phantom",
  "Vandal",
  "Marshal",
  "Outlaw",
  "Operator",
  "Ares",
  "Odin",
  "Knife",
  "Melee",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedWords(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/(^|[\s-])([a-z])/g, (_match, boundary: string, letter: string) => `${boundary}${letter.toUpperCase()}`);
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function canonicalWeapon(value: string) {
  const comparable = value.toLocaleLowerCase("en-US");
  const exact = VALORANT_WEAPONS.find((weapon) => weapon.toLocaleLowerCase("en-US") === comparable);
  if (exact) return exact;

  const candidates = VALORANT_WEAPONS
    .map((weapon) => ({ weapon, distance: editDistance(comparable, weapon.toLocaleLowerCase("en-US")) }))
    .sort((left, right) => left.distance - right.distance);
  const maximumDistance = comparable.length >= 7 ? 2 : 1;
  if (
    candidates[0] &&
    candidates[0].distance <= maximumDistance &&
    candidates[0].distance < (candidates[1]?.distance ?? Number.POSITIVE_INFINITY)
  ) return candidates[0].weapon;
  return displayName(value);
}

function titleTexts(result: unknown) {
  if (!isRecord(result)) return [];
  const value = isRecord(result.result) ? result.result : result;
  const collections: unknown[] = [];
  if (Array.isArray(value.items)) collections.push(value.items);
  if (Array.isArray(value.frames)) {
    for (const frame of value.frames) {
      if (isRecord(frame) && Array.isArray(frame.items)) collections.push(frame.items);
    }
  }
  return collections.flatMap((collection) => {
    if (!Array.isArray(collection)) return [];
    return collection.flatMap((item) => {
      if (!isRecord(item) || typeof item.name !== "string" || item.name.toLocaleLowerCase("en-US") !== "title") return [];
      return typeof item.text === "string" ? [item.text] : [];
    });
  });
}

export function cleanInventoryResult(result: unknown): InventoryWeaponGroup[] {
  const grouped = new Map<string, { weapon: string; skins: Map<string, string> }>();
  for (const text of titleTexts(result)) {
    const words = normalizedWords(text).split(" ").filter(Boolean);
    if (words.length < 2) continue;
    const rawWeapon = words.pop()!.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
    const rawSkin = words.join(" ").replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
    if (!rawWeapon || !rawSkin) continue;

    const weapon = canonicalWeapon(rawWeapon);
    const skin = displayName(rawSkin);
    const weaponKey = weapon.toLocaleLowerCase("en-US");
    const skinKey = skin.toLocaleLowerCase("en-US");
    const group = grouped.get(weaponKey) ?? { weapon, skins: new Map<string, string>() };
    if (!group.skins.has(skinKey)) group.skins.set(skinKey, skin);
    grouped.set(weaponKey, group);
  }
  return [...grouped.values()].map((group) => ({
    weapon: group.weapon,
    skins: [...group.skins.values()],
  }));
}

export function formatInventoryGroups(groups: InventoryWeaponGroup[]) {
  return groups
    .map((group) => `${group.weapon}:\n${group.skins.map((skin, index) => `${index + 1}. ${skin}`).join("\n")}`)
    .join("\n\n");
}

