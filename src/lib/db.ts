import Dexie, { type EntityTable } from 'dexie';

export interface ImageRecord {
    filename: string;
    blob: Blob;
}

export class ImageDB extends Dexie {
    images!: EntityTable<ImageRecord, 'filename'>;

    constructor() {
        super('ImageDB');

        this.version(1).stores({
            images: '&filename'
        });

        this.images = this.table('images');
    }
}

export const db = new ImageDB();

export const getStoredImage = (filename: string) => db.images.get(filename);

export const putStoredImage = (record: ImageRecord) => db.images.put(record);

export const deleteStoredImages = (filenames: string[]) => db.images.where('filename').anyOf(filenames).delete();
