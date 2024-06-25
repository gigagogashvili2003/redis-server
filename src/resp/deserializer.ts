import { CRLF } from "../constants";
import { IDeserializer } from "../interfaces";

export class Deserializer implements IDeserializer {
  public constructor(public input: string) {}

  public deserializeArrCommands(): string[] {
    this.validateArrCommands();

    const splitByCRLF = this.input.split(CRLF);
    const elementsCount = parseInt(splitByCRLF.at(0)!.substring(1), 10);
    const elements: string[] = [];

    for (let i = 2; i < splitByCRLF.length; i += 2) {
      elements.push(splitByCRLF[i]);
    }

    if (elementsCount !== elements.length) {
      throw new Error("Invalid Command!");
    }

    return elements;
  }

  private validateArrCommands() {
    if (!this.input.startsWith("*")) {
      throw new Error("Invalid Command!");
    }

    if (!this.input.endsWith(CRLF)) {
      throw new Error("Invalid Command!");
    }
  }

  public deserialize() {}
}
