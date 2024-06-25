import { CRLF } from "../constants";
import { DataType } from "../enums";
import { ISerializer } from "../interfaces";
import { AllowedType } from "../types";

export class Serializer implements ISerializer {
  public constructor() {}

  public serialize(type: DataType, input: AllowedType) {
    switch (type) {
      case DataType.SIMPLE_STRING: {
        return `${type}${input}${CRLF}`;
      }
      case DataType.SIMPLE_ERROR: {
        return `${type}${input}${CRLF}`;
      }

      case DataType.INTEGER: {
        return `${type}${input}${CRLF}`;
      }

      default: {
        return `${type}${input}${CRLF}`;
      }
    }
  }

  public serializeSimpleString() {}
}
