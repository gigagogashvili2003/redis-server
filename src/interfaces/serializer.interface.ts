import { DataType } from "../enums";
import { AllowedTypes } from "../types";

export interface ISerializer {
  serialize(type: DataType, input: AllowedTypes): string;
}
