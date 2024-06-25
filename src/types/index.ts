import { Command } from "../enums";

export type AllowedType = string | number | boolean | Array<AllowedType>;
export type AllowedOptions = { ttl?: Date };
export type ValueType = { value: AllowedType; counter: number; options?: AllowedOptions };
export type MapType = Map<string, ValueType>;
export type ArrayType = Array<AllowedType>;
export type CommandsArrType = [Command, ...Array<string>];
export type OperationType = "increment" | "decrement";
export type SetOptions = "EX" | "PX";
