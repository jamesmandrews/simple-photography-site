import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Collection } from "./Collection";
import { PhotoMeta } from "./PhotoMeta";

@Entity("photos")
export class Photo {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "boolean", default: false })
  featured: boolean;

  @ManyToOne(() => Collection, (collection) => collection.photos)
  @JoinColumn({ name: "collectionId" })
  collection: Collection;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "varchar", length: 500 })
  src: string;

  @Column({ type: "varchar", length: 255 })
  alt: string;

  @Column({ type: "int" })
  width: number;

  @Column({ type: "int" })
  height: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => PhotoMeta, (meta) => meta.photo)
  meta: PhotoMeta[];
}
