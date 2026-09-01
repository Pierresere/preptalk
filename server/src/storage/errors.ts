export class NotFoundError extends Error {
  readonly status = 404

  constructor(id: string) {
    super(`Not found: ${id}`)
    this.name = 'NotFoundError'
  }
}

export class CorruptFileError extends Error {
  readonly status = 422

  constructor(path: string, cause: unknown) {
    super(`Corrupt file ${path}: ${String(cause)}`)
    this.name = 'CorruptFileError'
  }
}

export class InvalidNameError extends Error {
  readonly status = 400

  constructor(name: string) {
    super(`Invalid document name: ${name}`)
    this.name = 'InvalidNameError'
  }
}
