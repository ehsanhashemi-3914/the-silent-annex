export type ItemKind = 'key' | 'puzzle' | 'consumable' | 'document';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
  /** Which procedural 3D model represents this item in the inspector and on icons. */
  model: string;
  /** Document opened when a 'document' item is used from the inventory. */
  docId?: string;
}
