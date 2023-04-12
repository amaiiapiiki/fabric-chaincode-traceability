# Hyperledger Fabric Smart Contract
This is a smart contract built on the Hyperledger Fabric blockchain platform. This contract provides a set of functions that can be called by authorized users to interact with the blockchain.

## Index

1. [Installation](#installation)
2. [Usage](#usage)
3. [Internal functions](#internal-functions)
4. [Public functions](#public-functions)

## Installation
To install the smart contract, first ensure that you have the necessary dependencies installed:

* Hyperledger Fabric 2.x
* Node.js 12.x

Then, run the following command to install the dependencies:

```bash
npm install
```

## Usage
To use the smart contract, first start up the blockchain network using the appropriate configuration files. Then, deploy the smart contract to the network.

### Calling Public Functions
The following functions are publicly available and can be called by authorized users to interact with the blockchain:

* `ProduceIngredientLot`
* `GetIngredient`
* `GetProductStatus`
* ...

To call one of these functions, use the Fabric SDK to submit a transaction to the network. The transaction should include the necessary arguments for the function being called.

### Calling Internal Functions
The following functions are internal and should not be called directly by users:

* `_GetClientIdentity`
* `_GetClientMSPID`
* `_ListItems`
* ...

These functions are used by the public functions to perform certain tasks, such as checking the identity of the client submitting the transaction.

## Internal functions

This chaincode defines several internal functions that are used by the exposed functions to perform operations on the ledger.

### `_GetClientIdentity(ctx)`
This function returns a new instance of the `ClientIdentity` class, which allows access to the identity of the client that submitted the transaction.

### `_GetClientMSPID(ctx)`
This function returns the MSP ID of the client that submitted the transaction.

### `_GetItem(ctx, type, id)`
This function retrieves the item with the specified `id` and `type` from the ledger and returns its value as a string.

### `_GetItemStatus(ctx, type, id)`
This function retrieves the status of the item with the specified `id` and `type` from the ledger and returns its value as a string.

### `_DeleteItem(ctx, type, id)`
This function deletes the item with the specified `id` and `type` from the ledger.

### `_ListItems(ctx, type, pageSize, bookmark)`
This function retrieves a list of all the items of the specified `type` from the ledger. The results are returned as a JSON string, which includes the list of items and metadata such as the total number of records and a bookmark to retrieve the next set of records if the number of records exceeds the page size.

### `_UpdateItemLocation(ctx, type, id, newLocationId)`
This function updates the location of an item. It takes in four parameters: the context object (ctx), the type of the item, its id, and the id of the new location. If the item or location does not exist, the function throws an error. It also checks that the participant updating the item's location is the holder of the item. The function then updates the item's locationId property and stores the updated item in the ledger.

### `_UpdateItemParameters(ctx, type, id)`
This function updates the parameters of an item. It takes in three parameters: the context object (ctx), the type of the item, and its id. The function checks that the participant updating the item's parameters is a Producer, Manufacturer, Courier, or Retailer. If the item does not exist, the function throws an error. It also checks that the participant updating the item's parameters is the holder of both the item and its current location. The function then updates the item's parameters property with the parameters of its current location and stores the updated item in the ledger.

### `_GetAllResults(iterator, isHistory)`
This function is used to retrieve all the query results from a given iterator object. It takes in two parameters: `iterator` and `isHistory`. The `iterator` is the object that contains the query results and `isHistory` is a boolean value that indicates whether the query is a history query or not.

The function returns a stringified JSON object that contains all the query results. If the query is a history query, the JSON object will include the transaction ID, timestamp, and value. Otherwise, it will include the key and the record.

### `_GetQueryResultForQueryString(ctx, queryString)`
This function is used to retrieve the query results for a given query string. It takes in two parameters: `ctx` and `queryString`. The `ctx` parameter is the object that contains the request context and queryString is the query string that specifies the query.

The function returns a stringified JSON object that contains the query results.

## Public functions
### ProduceIngredientLot

The `ProduceIngredientLot` function is an async function that creates a new ingredient lot on the blockchain.

Parameters
* `ctx`: the transaction context object
* `ingredientLotId`: a string that represents the unique ID of the ingredient lot to be created
* `name`: a string that represents the name of the ingredient
* `description`: a string that represents the description of the ingredient
* `lot`: a string that represents the lot number of the ingredient
* `locationId`: a string that represents the ID of the location where the ingredient was produced
* `parameters`: a stringified JSON object that represents the parameters associated with the ingredient lot

Functionality

The function checks whether the submitter of the transaction is a `Producer`. If not, an error is thrown. It also checks whether the `mspID` of the submitter is `agr1MSP`.

The function then checks whether the location with the given `locationId` exists. If not, an error is thrown.

If an ingredient lot with the given `ingredientLotId` already exists, an error is thrown.

The function creates an `ingredientLot` object containing the `docType`, `id`, `name`, `description`, `lot`, and `producerId` properties.

It also creates a state object containing the `status`, `holderId`, `locationId`, `destinationId`, `active`, and `parameters` properties.

The function then creates unique keys for both the `ingredientLot` and `state` objects and puts them into the blockchain.

Finally, the function returns the `ingredientLot` object in JSON format.

### ListIngredients
This function retrieves a list of all ingredients stored on the blockchain. The caller must have the 'Producer' role and must belong to the 'agr1MSP' MSP.

Parameters

* `ctx`: the transaction context
* `pageSize`: the maximum number of items to return
* `bookmark`: the bookmark to start returning items from (optional)

Returns

An array of JSON objects, each representing an ingredient. Each object contains the following fields:

* `id`: the ID of the ingredient
* `name`: the name of the ingredient
* `description`: a brief description of the ingredient
* `lot`: the lot number of the ingredient
* `producerId`: the MSP ID of the producer that created the ingredient

Errors

* `Error`: the caller is not a member of the 'agr1MSP' MSP, or does not have the 'Producer' role.

### GetIngredient
This function retrieves a specific ingredient from the blockchain, given its ID.

Parameters
* `ctx`: the transaction context
* `ingredientLotId`: the ID of the ingredient to retrieve

Returns

A JSON object representing the ingredient. The object contains the same fields as those returned by the ListIngredients function.

Errors
* `Error`: the specified ingredient does not exist.

### GetIngredientStatus
This function retrieves the status of a specific ingredient from the blockchain, given its ID.

Parameters

* `ctx`: the transaction context
* `ingredientLotId`: the ID of the ingredient whose status is to be retrieved

Returns

A JSON object representing the status of the ingredient. The object contains the following fields:

* `status`: the current status of the ingredient (e.g. 'IDLE', 'LOST_OR_DESTROYED', 'CONSUMED', etc.)
* `holderId`: the MSP ID of the entity currently holding the ingredient
* `locationId`: the ID of the location where the ingredient is currently located
* `destinationId`: the ID of the location where the ingredient is destined to go (if applicable)
* `active`: a boolean indicating whether the ingredient is still active (i.e. not lost or consumed)
* `parameters`: an object containing additional parameters related to the ingredient

Errors

* `Error`: the specified ingredient does not exist.

### GetHistoricalDataIngredient
This function retrieves the historical data for a specific ingredient lot ID. It first creates a composite key using the provided ingredient lot ID and the 'STATUS' keyword, then uses this key to retrieve the historical data using the Hyperledger Fabric API `getHistoryForKey()`. The function then calls the internal `_GetAllResults()` function to convert the iterator result to an array of objects.

Parameters

* `ctx`: The transaction context object.
* `ingredientLotId`: The ID of the ingredient lot to retrieve historical data for.

Returns

The function returns an array of objects representing the historical data for the ingredient lot.

### DeleteIngredient
This function deletes an existing ingredient lot from the ledger. It first checks that the submitter is an admin from the `agr1MSP` organization, and then checks that the submitter is from the same organization that created the ingredient. If these conditions are met, the function deletes the ingredient using the internal `_DeleteItem()` function.

Parameters

* `ctx`: The transaction context object.
* `ingredientLotId`: The ID of the ingredient lot to delete.

Returns

The function returns a string indicating that the ingredient lot with the provided ID was deleted.

### UpdateIngredientLocation
This function updates the location of an ingredient item in the blockchain by calling the `_UpdateItemLocation` function, passing the item type as `types.INGREDIENT`, the item ID as id, and the new location ID as `newLocationId`. If the update is successful, it returns a message indicating that the location of the item with the given ID has changed.

Parameters

* `ctx`: The transaction context object.
* `id`: The ID of the ingredient item whose location is being updated.
* `newLocationId`: The new location ID to set for the item.

Returns

Returns a message indicating that the location of the ingredient item with the given ID has changed.

### UpdateIngredientParameters
This function updates the parameters of an ingredient item in the blockchain by calling the `_UpdateItemParameters` function, passing the item type as `types.INGREDIENT` and the item ID as `id`. If the update is successful, it returns a message indicating that the parameters of the item with the given ID have changed.

Parameters
* `ctx`: The transaction context object.
* `id`: The ID of the ingredient item whose parameters are being updated.

Returns

Returns a message indicating that the parameters of the ingredient item with the given ID have changed.

### CreateLocation
This function creates a new location in the blockchain by creating a new object with the type `types.LOCATION` and the given parameters, and then storing it in the ledger using the `putState` function. If the location ID already exists, it throws an error. The function checks if the caller has the necessary role to perform the action. If the location creation is successful, it returns a stringified version of the created location object.

Parameters

* `ctx`: The transaction context object.
* `locationId`: The ID of the new location being created.
* `name`: The name of the new location.
* `type`: The type of the new location.
* `latitude`: The latitude of the new location.
* `longitude`: The longitude of the new location.
* `parameters`: The parameters of the new location as a stringified JSON object.

Returns

Returns a stringified version of the created location object.

### GetLocation

Returns the location with the specified `locationId`.

Parameters

* `ctx`: the transaction context.
* `locationId`: the ID of the location to retrieve.

Returns

* A Promise that resolves to a string containing the JSON representation of the location object.

### UpdateLocationParameters
Updates the parameters of a location with the specified `id`.

Parameters

* `ctx`: the transaction context.
* `id`: the ID of the location to update.
* `newParameters`: the new parameters for the location, in JSON format.

Returns

* A Promise that resolves to a string indicating that the parameters of the location with the specified `id` have been updated.

Errors

* An error indicating that the submitter is not authorized to perform the update.
* An error indicating that the location with the specified id does not exist.

### UpdateLocationCoordinates
Updates the coordinates of a vehicle with the specified `id`.

Parameters

* `ctx`: the transaction context.
* `id`: the ID of the vehicle to update.
* `latitude`: the new latitude of the vehicle.
* `longitude`: the new longitude of the vehicle.

Returns

* A Promise that resolves to a string indicating that the coordinates of the vehicle with the specified `id` have been updated.

Errors

* An error indicating that the submitter is not authorized to perform the update.
* An error indicating that the location with the specified id does not exist.
* An error indicating that the location with the specified id is not a vehicle.

### StartShipment
This function is responsible for starting a shipment by updating the status of an item to `IN_TRANSIT`, and assigning it to a courier.

Parameters

* `ctx`: the transaction context.
* `itemId`: the ID of the item being shipped.
* `itemType`: the type of the item being shipped.
* `courierId`: the ID of the courier who will deliver the item.
* `locationId`: the ID of the location where the item is currently located.
* `destinationId`: the ID of the destination where the item is being shipped to.

Returns

* A Promise that resolves to a JSON string representing the updated item.

Errors

* An error indicating that the submitter is not authorized to perform the update.
* An error indicating that the submitter is not a Producer or Manufacturer.
* An error indicating that the courier ID is not valid.
* An error indicating that the item type is invalid.
* An error indicating that the location with the specified ID does not exist.
* An error indicating that the destination with the specified ID does not exist.
* An error indicating that the item with the specified ID does not exist.
* An error indicating that the current participant is not the holder of the item.
* An error indicating that the item is not in IDLE or VALIDATED status.

### ShipmentStep Function
This function is responsible for starting a shipment by updating the status of an item to `IN_TRANSIT`, and assigning it to a courier.

Parameters
* `ctx`: the transaction context.
* `itemId`: the ID of the item being shipped.
* `itemType`: the type of the item being shipped.
* `courierId`: the ID of the courier who will deliver the item.
* `locationId`: the ID of the location where the item is currently located.

Returns

* A Promise that resolves to a JSON string representing the updated item.

Errors

This function can throw the following errors:

* An error indicating that the submitter is not authorized to perform the update.
* An error indicating that the submitter is not a Courier.
* An error indicating that the courier ID is not valid.
* An error indicating that the item type is invalid.
* An error indicating that the location with the specified ID does not exist.
* An error indicating that the item with the specified ID does not exist.
* An error indicating that the current participant is not the holder of the item.
An error indicating that the item is not in `IN_TRANSIT` status.
An error indicating that the new courier and the current holder are from the same organization.

### FinishShipment
The `FinishShipment` function is a Hyperledger Fabric chaincode function that finishes the shipment of an item by updating its status to `DELIVERED`. It also updates the holder ID and location ID of the item.

Parameters

* `ctx`: The transaction context object.
* `itemId`: The ID of the item to finish the shipment for.
* `itemType`: The type of the item.
* `holderId`: The ID of the organization that will be the holder of the item.
* `locationId`: The ID of the location where the item is being delivered.

Returns

* Returns a JSON string representing the updated item.

Errors

* An error indicating that the function is invoked by a participant that is not a courier or does not belong to courier1MSP or courier2MSP organization.
* An error indicating that the submitter of the transaction is not a courier.
* An error indicating that the holderId parameter is not valid.
* An error indicating that the location with the given locationId does not exist.
* An error indicating that the itemType parameter is empty.
* An error indicating that the item with the given itemId and itemType does not exist.
* An error indicating that Tthe caller is not the current holder of the item.
* An error indicating that the item is not in transit.

### ValidateFinishShipment
This function validates the shipment delivery by the recipient, and sets the status of the shipment to "validated".

Parameters

* `ctx`: The transaction context object
* `itemId`: The ID of the item being validated
* `itemType`: The type of the item being validated

Returns

* Returns a stringified JSON object representing the validated item.

Errors

* Throws an error if the caller is not a Manufacturer or a Client.
* Throws an error if the item type is empty.
* Throws an error if the item with the given ID and type does not exist.
* Throws an error if the current participant is not the holder of the item.
* Throws an error if the item status is not "delivered".
* Throws an error if the item is not at the correct destination.

### ManufactureProductLot
This function creates a new product lot with the given parameters, and updates the status of its ingredients to 'CONSUMED'.

Parameters

* `ctx`: the transaction context.
* `id`: the ID of the new product lot.
* `name`: the name of the new product lot.
* `description`: the description of the new product lot.
* `ingredientsId`: a JSON array containing the IDs of the ingredients that will be used to create the product lot.
* `lot`: the lot number of the new product lot.
* `locationId`: the ID of the location where the new product lot will be created.
* `parameters`: a JSON object containing additional parameters for the new product lot.

Returns

* A Promise that resolves to a JSON string representing the new product lot.

Errors

This function can throw the following errors:

* An error indicating that the participant is not from the floretteMSP organization.
* An error indicating that the submitter is not a Manufacturer.
* An error indicating that no ingredients were given.
* An error indicating that there is already a product with the specified ID.
* An error indicating that an ingredient with the specified ID does not exist.
* An error indicating that the ingredient is not at the location where the product will be created.
* An error indicating that the ingredient is not validated.
* An error indicating that the current participant is not the holder of the ingredient.

### GetProduct
Retrieve a product from the ledger by its ID.

Parameters

* `ctx`: The transaction context object.
* `productId`: The ID of the product to retrieve.

Returns

* Returns the product object as a JSON string.

### GetProductStatus
Retrieve the status of a product from the ledger by its ID.

Parameters
* `ctx`: The transaction context object.
* `productId`: The ID of the product to retrieve the status of.

Returns

* Returns the status of the product as a JSON string.


### ListProducts
List all products from the ledger.

Parameters
* `ctx`: The transaction context object.
* `pageSize`: The maximum number of products to return per page.
* `bookmark`: The bookmark to use when querying for the next page of results.

Returns

* Returns a paginated list of product objects as a JSON string.

### GetHistoricalDataProduct
Retrieve the historical data of a product from the ledger by its ID.

Parameters

`ctx`: The transaction context object.
`productLotId`: The ID of the product to retrieve the historical data of.

Returns

* Returns a list of historical data for the product as a JSON string.

### UpdateProductLocation
Update the location of a product on the ledger by its ID.

Parameters

* `ctx`: The transaction context object.
* `productId`: The ID of the product to update.
* `locationId`: The new location ID.

Returns

* Returns a confirmation message.


UpdateProductParameters
Update the parameters of a product on the ledger by its ID.

Parameters

* `ctx`: The transaction context object.
* `productId`: The ID of the product to update.

Returns

* Returns a confirmation message.

### InvalidateItem
This function is used to invalidate an item by changing its status to `LOST_OR_DESTROYED`.

Parameters

* `ctx`: The transaction context.
* `itemId`: The ID of the item to be invalidated.
* `itemType`: The type of the item to be invalidated.

Returns

* A JSON string representing the invalidated item.

Errors

* Throws an error if the submitter is not a Producer or Manufacturer.
* Throws an error if the submitter's MSP ID is not `floretteMSP` or `agr1MSP`.
* Throws an error if the submitter is not a Producer or Manufacturer.
* Throws an error if the `itemType` is empty.
* Throws an error if the item does not exist.
* Throws an error if the current participant is not the holder of the item.