New Data model:

  1. Ingredient:

    - uuid: string
    - name: string
    - description: string
    - lot: string
    - active: boolean
    - status: "IDLE" | "LOST_OR_DESTROYED" | "CONSUMED" | "IN_TRANSIT" | "DELIVERED" | "VALIDATED"
    - locationId: string
    - holderId: string
    - producerId: string

  2. Product:

    - uuid: string
    - name: string
    - description: string,
    - lot: string
    - active: boolean
    - status: "IDLE" | "LOST_OR_DESTROYED" | "CONSUMED" | "IN_TRANSIT" | "DELIVERED" | "VALIDATED"
    - holderId: string
    - manufacturerId: string
    - locationId: string
    - ingredients: [ingredientsID]

  3. Shipment:

    - uuid: string
    - locationId: string
    - destinationId: string

  4. Location:

    - uuid: string
    - name: string
    - latitude: float
    - longitude: float
    - parameters: []
    - holderId: string



mejoras que propone cesar:
* en algunas transacciones recuperamos todo el item para actualizar solo unos parámetros (RENDIMIENTO)
    * misma clave añadiendole status con los nuevos parámetros
    * después de startshipment recuperar solo parcialmente 
* si los parámetros los vamos a actualizar periodicamente merece la pena una clave por separado
* almacenar una sset en diferentes claves y luego para recuperar todo llamar por trozos
    * mejor rendiemiento
    * dividir según el uso en las transacciones

* REQUISITOS
    * la solución debe dejar constancia de la trazabilidad de los productos en una plataforma Blockchain
    * funcional/usuario lo que la aplicaciones debe hacer
    * no funcionales/sistema como lo hace