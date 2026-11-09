import type { ItemDef } from './Item';

const items: ItemDef[] = [
  {
    id: 'battery',
    name: 'Torch Battery',
    kind: 'consumable',
    description: 'A heavy 6-volt lantern cell. Still holds some charge. Restores half of the torch.',
    model: 'battery',
  },
  {
    id: 'admin_key',
    name: 'Administration Key',
    kind: 'key',
    description: 'Brass, on a paper tag written in a tidy hand: "Admin. Please return to R. Szabo."',
    model: 'keyBrass',
  },
  {
    id: 'security_card',
    name: 'Security Access Card',
    kind: 'key',
    description: 'Laminated card issued to Dr. H. Marek. Grade 2 clearance. The photo has been scratched away.',
    model: 'card',
  },
  {
    id: 'storage_key',
    name: 'Storage Key',
    kind: 'key',
    description: 'A steel key stamped "EQ. STORE". Someone wound red tape around the bow.',
    model: 'keySteel',
  },
  {
    id: 'fuse_30a',
    name: '30A Ceramic Fuse',
    kind: 'puzzle',
    description: 'A heavy ceramic cartridge with brass caps and a green band: 30 amps.',
    model: 'fuse',
  },
  {
    id: 'lift_key',
    name: 'Maintenance Key',
    kind: 'key',
    description: 'A barrel key for the goods lift. The fob reads "LEVEL C, AUTHORISED STAFF ONLY".',
    model: 'keyBarrel',
  },
  {
    id: 'research_notes',
    name: 'Research Notes',
    kind: 'document',
    description: "Hana's field notebook. The handwriting gets smaller toward the end.",
    model: 'notebook',
    docId: 'hana_notebook',
  },
  {
    id: 'test44_reel',
    name: 'Reel: Test 44',
    kind: 'puzzle',
    description: 'A 10-inch video reel in a sealed sleeve, labelled "G / 44 / 0317". Heavier than it should be.',
    model: 'reel',
  },
  {
    id: 'security_key',
    name: 'Security Control Key',
    kind: 'key',
    description: 'A short key on a steel chain, tagged "SEC. CTRL, LEVEL C".',
    model: 'keySteel',
  },
  {
    id: 'ignition_key',
    name: 'Generator Ignition Key',
    kind: 'key',
    description: "The director's own key to the deep generator. It has a heavy brass collar.",
    model: 'keyBarrel',
  },
];

const byId = new Map(items.map((item) => [item.id, item]));

export const ItemDatabase = {
  all: items as readonly ItemDef[],
  get(id: string): ItemDef | undefined {
    return byId.get(id);
  },
  has(id: string): boolean {
    return byId.has(id);
  },
};
