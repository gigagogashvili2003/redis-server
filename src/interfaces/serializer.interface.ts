import { DataType } from "../enums";
import { AllowedType } from "../types";

export interface ISerializer {
  serialize(type: DataType, input: AllowedType): string;
}
