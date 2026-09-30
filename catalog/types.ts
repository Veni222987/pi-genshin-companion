import type { Element } from "./elements.ts";

export interface Artwork {
  id: string;
  name: string;
  width: number;
  height: number;
  palette: Record<string, readonly [number, number, number]>;
  pixels: string[];
}

export interface Quote {
  category: string;
  text: string;
}

export interface Character {
  id: string;
  name: string;
  englishName: string;
  element: Element;
  defaultArtwork: string;
  artworks: Artwork[];
  quotes: Quote[];
}

export interface Catalog {
  characters: Character[];
  warnings: string[];
}

export interface Selection {
  characterId: string;
  artworkId: string;
}
