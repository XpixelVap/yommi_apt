export interface StoredFile {
  relativePath: string;
  publicUrl: string;
}

export interface FileStorage {
  save(input: { data: Buffer; folder: string; filename: string }): Promise<StoredFile>;
}