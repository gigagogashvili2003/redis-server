import { CRLF } from "../constants";

export class Deserializer {
  public constructor(public data: string) {}

  public deserialize() {
    const lines = this.data.split(CRLF);

    const elementsCount = parseInt(lines.at(0)!.substring(1), 10);
    const elements: string[] = [];

    for (let i = 2; i < lines.length; i += 2) {
      elements.push(lines[i]);
    }

    if (elements.length !== elementsCount) {
      throw new Error("Invalid Command!");
    }

    return [elements.at(0), elements.at(1), elements.at(2)];
  }
}
