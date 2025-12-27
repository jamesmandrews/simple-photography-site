import "reflect-metadata";
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
  type: "mariadb",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3307"),
  username: process.env.DB_USER || "photo_user",
  password: process.env.DB_PASSWORD || "photo_password",
  database: process.env.DB_NAME || "photo_db",
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV !== "production",
  entities: [__dirname + "/entities/*.{ts,js}"],
  migrations: [__dirname + "/migrations/*.{ts,js}"],
});
