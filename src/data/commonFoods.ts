import type { FoodItem } from '../engine/types';

/**
 * Home-made and fresh foods for quick logging. Nutrition is rounded from USDA FoodData Central
 * values for typical home recipes and portions, so treat it as an estimate.
 */
const f = (id: string, name: string, brand: string, serving: string, ingredients: string, n: FoodItem['n']): FoodItem =>
  ({ id: 'c-' + id, name, brand, serving, ingredients, n, source: 'common', whole: true });

export const COMMON_FOODS: FoodItem[] = [
  f('oatmeal', 'Oatmeal with banana', 'Home-made', '1 bowl', 'Rolled oats, milk, banana, cinnamon.', { kcal: 300, protein: 10, fiber: 7, sugar: 15, sodium: 100, caffeine: 0 }),
  f('chai', 'Masala chai', 'Home-made', '1 cup', 'Black tea, milk, sugar, cardamom, cinnamon, clove.', { kcal: 120, protein: 4, fiber: 0, sugar: 12, sodium: 55, caffeine: 40 }),
  f('dal', 'Dal and rice', 'Home-made', '1 plate', 'Yellow lentils, basmati rice, ghee, tomato, turmeric, cumin, salt.', { kcal: 450, protein: 16, fiber: 9, sugar: 3, sodium: 520, caffeine: 0 }),
  f('dal-bowl', 'Dal (lentil soup)', 'Home-made', '1 bowl', 'Yellow lentils, tomato, ghee, turmeric, cumin, salt.', { kcal: 230, protein: 12, fiber: 8, sugar: 2, sodium: 400, caffeine: 0 }),
  f('rice', 'Basmati rice, cooked', 'Home-made', '1 cup', 'Basmati rice.', { kcal: 210, protein: 4, fiber: 1, sugar: 0, sodium: 2, caffeine: 0 }),
  f('chapati', 'Chapati (2)', 'Home-made', '2 pieces', 'Whole wheat flour, water, salt, ghee.', { kcal: 240, protein: 8, fiber: 6, sugar: 1, sodium: 300, caffeine: 0 }),
  f('vegcurry', 'Vegetable curry', 'Home-made', '1 bowl', 'Cauliflower, green peas, bell pepper, tomato, sunflower oil, turmeric, cumin, coriander, salt.', { kcal: 280, protein: 7, fiber: 7, sugar: 8, sodium: 520, caffeine: 0 }),
  f('paneer', 'Palak paneer', 'Home-made', '1 bowl', 'Spinach, paneer, tomato, cream, ghee, cumin, garam masala, salt.', { kcal: 330, protein: 15, fiber: 4, sugar: 5, sodium: 560, caffeine: 0 }),
  f('khichdi', 'Khichdi', 'Home-made', '1 bowl', 'Rice, moong dal, ghee, cumin, turmeric, salt.', { kcal: 320, protein: 11, fiber: 5, sugar: 1, sodium: 420, caffeine: 0 }),
  f('upma', 'Upma', 'Home-made', '1 bowl', 'Semolina, sunflower oil, mustard seeds, curry leaves, peas, cashews, salt.', { kcal: 280, protein: 7, fiber: 3, sugar: 2, sodium: 380, caffeine: 0 }),
  f('poha', 'Poha', 'Home-made', '1 bowl', 'Flattened rice, peanuts, sunflower oil, mustard seeds, turmeric, peas, lemon juice, salt.', { kcal: 270, protein: 6, fiber: 3, sugar: 2, sodium: 350, caffeine: 0 }),
  f('yogurt', 'Plain yogurt', 'Home-made', '1 cup', 'Milk, cultures.', { kcal: 150, protein: 9, fiber: 0, sugar: 11, sodium: 115, caffeine: 0 }),
  f('lassi', 'Sweet lassi', 'Home-made', '1 glass', 'Yogurt, milk, sugar, cardamom.', { kcal: 220, protein: 8, fiber: 0, sugar: 30, sodium: 110, caffeine: 0 }),
  f('milk', 'Milk, whole', 'Fresh', '1 cup', 'Milk.', { kcal: 150, protein: 8, fiber: 0, sugar: 12, sodium: 105, caffeine: 0 }),
  f('salad', 'Mixed green salad', 'Home-made', '1 bowl', 'Lettuce, cucumber, tomato, olive oil, lemon juice, salt.', { kcal: 120, protein: 2, fiber: 4, sugar: 4, sodium: 150, caffeine: 0 }),
  f('apple', 'Apple', 'Fresh fruit', '1 medium', 'Apple.', { kcal: 95, protein: 0, fiber: 4, sugar: 19, sodium: 2, caffeine: 0 }),
  f('banana', 'Banana', 'Fresh fruit', '1 medium', 'Banana.', { kcal: 105, protein: 1, fiber: 3, sugar: 14, sodium: 1, caffeine: 0 }),
  f('orange', 'Orange', 'Fresh fruit', '1 medium', 'Orange.', { kcal: 60, protein: 1, fiber: 3, sugar: 12, sodium: 0, caffeine: 0 }),
  f('pear', 'Pear', 'Fresh fruit', '1 medium', 'Pear.', { kcal: 100, protein: 1, fiber: 6, sugar: 17, sodium: 2, caffeine: 0 }),
  f('almonds', 'Almonds', 'Fresh', '1 oz (23 nuts)', 'Almonds.', { kcal: 165, protein: 6, fiber: 4, sugar: 1, sodium: 0, caffeine: 0 }),
  f('coffee', 'Coffee, black', 'Brewed', '12 fl oz', 'Brewed coffee.', { kcal: 5, protein: 0, fiber: 0, sugar: 0, sodium: 10, caffeine: 140 }),
  f('green-tea', 'Green tea', 'Brewed', '1 cup', 'Green tea.', { kcal: 2, protein: 0, fiber: 0, sugar: 0, sodium: 2, caffeine: 28 }),
  f('herbal-tea', 'Herbal tea (caffeine-free)', 'Brewed', '1 cup', 'Herbal infusion.', { kcal: 2, protein: 0, fiber: 0, sugar: 0, sodium: 2, caffeine: 0 }),
  f('water', 'Water', 'Tap or bottled', '1 glass', 'Water.', { kcal: 0, protein: 0, fiber: 0, sugar: 0, sodium: 0, caffeine: 0 }),
];
