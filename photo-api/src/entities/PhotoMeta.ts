import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Photo } from "./Photo";

@Entity("photo_meta")
export class PhotoMeta {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Photo, (photo) => photo.meta)
  @JoinColumn({ name: "photoId" })
  photo: Photo;

  @Column({ type: "varchar", length: 100 })
  key: string;

  @Column({ type: "varchar", length: 500 })
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
