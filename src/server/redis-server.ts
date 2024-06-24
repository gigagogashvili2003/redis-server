import { Server, Socket, createServer } from "net";
import { IRedisServer } from "../interfaces";
import { Deserializer } from "../resp/deserializer";
import { Command, DataType } from "../enums";
import { Serializer } from "../resp";

export class RedisServer implements IRedisServer {
  private server?: Server;

  public constructor(private port: number, private host: string) {
    this.init(port, host);
  }

  private async handleData(data: Buffer) {
    const deserializer = new Deserializer(data.toString());
    const [command, key, value] = deserializer.deserialize();

    console.log(command, key, value);

    switch (command) {
      case Command.PING: {
        return this.constructResponse(DataType.SIMPLE_STRING, "PONG");
      }

      case Command.ECHO: {
        // return this.constructResponse(DataType.)
        return "+echo\r\n";
      }

      default: {
        return this.constructResponse(DataType.SIMPLE_ERROR, "Invalid RESP Command!");
      }
    }
  }

  private constructResponse(type: DataType, output: string) {
    const serializedResponse = new Serializer().serialize(type, output);
    return serializedResponse;
  }

  private init(port: number, host: string) {
    this.server = createServer((socket: Socket) => {
      socket.on("data", (data: Buffer) => this.handleData(data).then((data) => socket.write(data)));

      socket.on("error", (error: Error) => {
        console.log(error);
      });
    });

    this.server.listen(port, host, () => {
      console.log(`Server is listening on port:${port}, at ${host}`);
    });
  }
}
