import { describe, expect, it } from 'vitest';
import { COFFEES, DRIP_BAGS, FREE_DELIVERY_FROM_BYN, SUBSCRIPTION } from '@/lib/catalog';

describe('catalog', () => {
  it('lists three coffees with the agreed prices and roast levels', () => {
    expect(COFFEES.map((c) => c.id)).toEqual(['ethiopia', 'colombia', 'brazil']);
    expect(COFFEES.map((c) => c.number)).toEqual([1, 2, 3]);
    expect(COFFEES.map((c) => c.priceBYN)).toEqual([32, 29, 26]);
    expect(COFFEES.map((c) => c.roastLevel)).toEqual([2, 3, 4]);
    expect(COFFEES.map((c) => c.roastLabel)).toEqual(['светлая', 'средняя', 'средне-тёмная']);
    expect(COFFEES.map((c) => c.name)).toEqual(['Иргачеффе', 'Уила', 'Серрадо']);
    expect(COFFEES.map((c) => c.country)).toEqual(['Эфиопия', 'Колумбия', 'Бразилия']);
    expect(COFFEES.map((c) => c.tone)).toEqual(['bergamot', 'apple', 'cocoa']);
    expect(COFFEES.every((c) => c.weightG === 250)).toBe(true);
  });

  it('has the flavour notes per coffee', () => {
    expect(COFFEES[0].notes).toEqual(['цветочный', 'бергамот']);
    expect(COFFEES[1].notes).toEqual(['карамель', 'красное яблоко']);
    expect(COFFEES[2].notes).toEqual(['орех', 'шоколад', 'под эспрессо']);
  });

  it('has drip bags, subscription and the free delivery threshold', () => {
    expect(DRIP_BAGS).toEqual({
      name: 'Дрип-пакеты, ассорти',
      pieces: 10,
      hint: 'для офиса и поездок',
      priceBYN: 18,
    });
    expect(SUBSCRIPTION).toEqual({ priceBYN: 54, bagsPerMonth: 2, weightG: 250, deliveryBYN: 0 });
    expect(FREE_DELIVERY_FROM_BYN).toBe(50);
  });
});
