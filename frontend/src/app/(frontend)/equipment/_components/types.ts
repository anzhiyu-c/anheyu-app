export interface EquipmentItem {
  name: string;
  image: string;
  link: string;
  description: string;
  specification: string;
}

export interface EquipmentCategory {
  title: string;
  description: string;
  equipment_list: EquipmentItem[];
}
