import { getReplicateClient } from './client'

const LINE_ART_MODEL = 'jagilley/controlnet-scribble:435061a1b5a4c1e26740464bf786efdfa9cb3a3ac488595a2de23e143fdb0117'

export async function processPhotoAsync(params: {
  imageUrl: string
  photoId: string
  webhookUrl: string
}): Promise<string> {
  const replicate = getReplicateClient()

  const prediction = await replicate.predictions.create({
    version: LINE_ART_MODEL,
    input: {
      image: params.imageUrl,
      prompt: 'minimalist ink drawing, black and white line art, clean sketch style, white background',
      image_resolution: '768',
      detect_resolution: 768,
    },
    webhook: params.webhookUrl,
    webhook_events_filter: ['completed'],
  })

  if (!prediction.id) throw new Error('Replicate did not return a prediction ID')
  return prediction.id
}
