export interface MealData {
  createdAt: string;
  datetime: string;
  id: number;
  imageBase64Strings: string[] | null;
  notes: string | null;
  type: string | null;
  userId: string;
}
