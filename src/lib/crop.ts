/** Recorte de imágenes en el cliente (editor de los mantenedores). */

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("No se pudo cargar la imagen"))
    image.src = src
  })
}

/**
 * Recorta `src` al área indicada (en píxeles de la imagen) y devuelve un PNG.
 * Con `circular: true` aplica una máscara redonda (el resto queda transparente),
 * para los tokens de criaturas y líderes que se dibujan en el mapa.
 */
export async function cropToBlob(
  src: string,
  area: CropArea,
  options?: { circular?: boolean },
): Promise<Blob> {
  const image = await loadImage(src)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(area.width))
  canvas.height = Math.max(1, Math.round(area.height))

  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas 2D no disponible")
  if (options?.circular) {
    context.beginPath()
    context.arc(
      canvas.width / 2,
      canvas.height / 2,
      Math.min(canvas.width, canvas.height) / 2,
      0,
      Math.PI * 2,
    )
    context.clip()
  }
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo generar el recorte")),
      "image/png",
    )
  })
}

/** Lee un File local como data-URL para previsualizarlo en el editor. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"))
    reader.readAsDataURL(file)
  })
}
