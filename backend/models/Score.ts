import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const ScoreSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    username: { type: String, required: true, index: true },
    display_name: { type: String, default: '' },
    score: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

ScoreSchema.index({ score: -1, username: 1 });

export type ScoreDocument = InferSchemaType<typeof ScoreSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ScoreModel: Model<ScoreDocument> =
  mongoose.models.Score || mongoose.model<ScoreDocument>('Score', ScoreSchema);
