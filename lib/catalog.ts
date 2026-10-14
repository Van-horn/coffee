// Range, drip bags and subscription constants. Roast levels are still unconfirmed with the client.
export const COFFEES = [
  {
    id: 'ethiopia',
    number: 1,
    country: 'Эфиопия',
    name: 'Иргачеффе',
    notes: ['цветочный', 'бергамот'],
    roastLevel: 2,
    roastLabel: 'светлая',
    priceBYN: 32,
    weightG: 250,
    tone: 'bergamot',
  },
  {
    id: 'colombia',
    number: 2,
    country: 'Колумбия',
    name: 'Уила',
    notes: ['карамель', 'красное яблоко'],
    roastLevel: 3,
    roastLabel: 'средняя',
    priceBYN: 29,
    weightG: 250,
    tone: 'apple',
  },
  {
    id: 'brazil',
    number: 3,
    country: 'Бразилия',
    name: 'Серрадо',
    notes: ['орех', 'шоколад', 'под эспрессо'],
    roastLevel: 4,
    roastLabel: 'средне-тёмная',
    priceBYN: 26,
    weightG: 250,
    tone: 'cocoa',
  },
] as const;

export type Coffee = (typeof COFFEES)[number];

export const DRIP_BAGS = {
  name: 'Дрип-пакеты, ассорти',
  pieces: 10,
  hint: 'для офиса и поездок',
  priceBYN: 18,
} as const;

export const SUBSCRIPTION = {
  priceBYN: 54,
  bagsPerMonth: 2,
  weightG: 250,
  deliveryBYN: 0,
} as const;

export const FREE_DELIVERY_FROM_BYN = 50;
