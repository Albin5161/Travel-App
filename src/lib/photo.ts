import * as ImagePicker from 'expo-image-picker';

/**
 * Your photo, picked from the library and cropped square. Returned as a data URI so it can be
 * kept on the device as plain text and survives restarts (a picked file's path is temporary).
 * Null when you cancel.
 */
export async function pickPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.35,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
}
