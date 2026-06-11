export const NEIGHBOURHOODS = [
  {
    name: 'Beltline',
    slug: 'beltline',
    postalPrefix: 'T2R',
    description: 'A dense inner-city neighbourhood known for high-rises, restaurants, and young professionals.',
  },
  {
    name: 'Mission',
    slug: 'mission',
    postalPrefix: 'T2S',
    description: 'A riverside neighbourhood with boutique shops, cafes, and heritage homes.',
  },
  {
    name: 'Kensington',
    slug: 'kensington',
    postalPrefix: 'T2N',
    description: 'A walkable village-style neighbourhood with independent shops and tree-lined streets.',
  },
  {
    name: 'Inglewood',
    slug: 'inglewood',
    postalPrefix: 'T2G',
    description: "Calgary's oldest neighbourhood, now a creative hub with galleries and artisan businesses.",
  },
  {
    name: 'Ramsay',
    slug: 'ramsay',
    postalPrefix: 'T2G',
    description: 'A quiet hillside community overlooking downtown with a strong local character.',
  },
  {
    name: 'Bridgeland',
    slug: 'bridgeland',
    postalPrefix: 'T2E',
    description: 'A vibrant inner-city community with a mix of heritage homes and new condos near the river.',
  },
  {
    name: 'Hillhurst',
    slug: 'hillhurst',
    postalPrefix: 'T2N',
    description: 'A close-in neighbourhood with character homes and quick access to downtown.',
  },
  {
    name: 'Bankview',
    slug: 'bankview',
    postalPrefix: 'T2T',
    description: 'A hillside community offering panoramic downtown views and a quiet residential feel.',
  },
  {
    name: 'Killarney',
    slug: 'killarney',
    postalPrefix: 'T3E',
    description: 'A family-friendly inner-west community with mature trees and well-kept bungalows.',
  },
  {
    name: 'Erlton',
    slug: 'erlton',
    postalPrefix: 'T2G',
    description: "A small riverside community steps from the Stampede grounds, popular with renters and owners alike.",
  },
]

export function findNeighbourhood(slug) {
  return NEIGHBOURHOODS.find(n => n.slug === slug)
}
