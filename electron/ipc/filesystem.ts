import fs from 'fs'
import path from 'path'

export function fillDrive(pathToFill: string, sizeInBytes: number): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdir(pathToFill, { recursive: true }, (err) => {
      if (err) return reject(err)

      let written = 0
      const chunkSize = 1024 * 1024 // 1MB chunks
      const buffer = Buffer.alloc(chunkSize)

      function writeChunk() {
        if (written >= sizeInBytes) {
          return resolve()
        }

        const toWrite = Math.min(chunkSize, sizeInBytes - written)
        const chunk = buffer.slice(0, toWrite)
        const filename = path.join(pathToFill, `fill_${written}.dat`)

        fs.writeFile(filename, chunk, (err) => {
          if (err) return reject(err)
          written += toWrite
          writeChunk()
        })
      }

      writeChunk()
    })
  })
}

export function replaceImages(directory: string, count: number, sourceImages: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      if (err) return reject(err)

      const imageFiles = files.filter(f => 
        ['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(path.extname(f).toLowerCase())
      )

      const toReplace = imageFiles.slice(0, count)

      toReplace.forEach((file, index) => {
        const sourceIndex = index % sourceImages.length
        const sourcePath = sourceImages[sourceIndex]
        const destPath = path.join(directory, file)

        fs.copyFile(sourcePath, destPath, (err) => {
          if (err) return reject(err)
          if (index === toReplace.length - 1) {
            resolve()
          }
        })
      })
    })
  })
}
