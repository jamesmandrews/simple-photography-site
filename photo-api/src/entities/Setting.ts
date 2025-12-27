import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("settings")
export class Setting {
  @PrimaryColumn({ type: "varchar", length: 100 })
  key: string;

  @Column({ type: "text" })
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
