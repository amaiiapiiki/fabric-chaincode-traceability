/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const { ClientIdentity } = require('fabric-shim');

const status = {
    IDLE: 'IDLE',
    LOST_OR_DESTROYED: 'LOST_OR_DESTROYED',
    CONSUMED: 'CONSUMED',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    VALIDATED: 'VALIDATED',
};


const types = {
    INGREDIENT: 'INGREDIENT',
    PRODUCT: 'PRODUCT',
    SHIPMENT: 'SHIPMENT', //No se usa?
    LOCATION: 'LOCATION'
};

const index = 'docType~id';

function Str2Hex(str) {
    return Buffer.from(str).toString('hex');
}



class Chaincode extends Contract {

    async ProduceIngredientLot(ctx, ingredientLotId, name, description, lot, locationId, parameters) {
        // Submitter must be a 'Producer'
        const cid = this._GetClientIdentity(ctx);
        const mspID = this._GetClientMSPID(ctx);

        if (mspID !== 'agr1MSP') {
            throw new Error('user msp must be agr1MSP');
        }

        if (!cid.assertAttributeValue('role', 'Producer')) {
            throw new Error('the submitter must be a Producer');
        }

        const locAsString = await this.GetLocation(ctx, locationId);
        if (!locAsString || locAsString.length === 0) {
            throw new Error(`location with id ${locationId} does not exist`);
        }

        // Check if the ingredient lot already exists
        const ingredientLotAsString = await this.GetIngredient(ctx, ingredientLotId);
        if (ingredientLotAsString.length > 0) {
            throw new Error(`ingredient with id ${ingredientLotId} already exists`);
        }

        // Create ingredient
        const ingredientLot = {
            docType: types.INGREDIENT,
            id: ingredientLotId,
            name: name,
            description: description,
            lot: lot,
            producerId: ctx.clientIdentity.getMSPID()
        };

        const state = {
            status: status.IDLE,
            holderId: ctx.clientIdentity.getMSPID(),
            locationId: locationId,
            destinationId: {},
            active: true,
            parameters: JSON.parse(parameters)
        };

        // Create unique key for putting the state
        const key = await ctx.stub.createCompositeKey(index, [ingredientLot.docType, ingredientLot.id]);
        await ctx.stub.putState(Str2Hex(key), Buffer.from(JSON.stringify(ingredientLot)));

        const key2 = await ctx.stub.createCompositeKey(index, [ingredientLot.docType, ingredientLot.id, 'STATUS']);
        await ctx.stub.putState(Str2Hex(key2), Buffer.from(JSON.stringify(state)));

        // Create empty entry in database to perform rich queries
        await ctx.stub.putState(key, Buffer.from('\u0000'));

        return JSON.stringify(ingredientLot);
    }


    async ListIngredients(ctx, pageSize, bookmark) {
        // Submitter must be a 'Producer'
        const cid = this._GetClientIdentity(ctx);
        const mspID = this._GetClientMSPID(ctx);

        if (mspID !== 'agr1MSP') {
            throw new Error('submitter must be from agr1MSP');
        }

        if (!cid.assertAttributeValue('role', 'Producer')) {
            throw new Error('the submitter must be a Producer');
        }

        // List items
        return await this._ListItems(ctx, types.INGREDIENT, pageSize, bookmark);
    }


    async GetIngredient(ctx, ingredientLotId) {
        return await this._GetItem(ctx, types.INGREDIENT, ingredientLotId);
    }

    async GetIngredientStatus(ctx, ingredientLotId) {
        return await this._GetItemStatus(ctx, types.INGREDIENT, ingredientLotId);
    }

    async GetHistoricalDataIngredient(ctx, ingredientLotId) {
        const key = await ctx.stub.createCompositeKey(index, [types.INGREDIENT, ingredientLotId, 'STATUS']);
        const iterator = await ctx.stub.getHistoryForKey(Str2Hex(key));

        return await this._GetAllResults(iterator, true);
    }


    async DeleteIngredient(ctx, ingredientLotId) {
        // Submiter must be an admin
        const cid = this._GetClientIdentity(ctx);
        const mspID = this._GetClientMSPID(ctx);

        if (mspID !== 'agr1MSP') {
            throw new Error('submitter must be from agr1MSP');
        }

        if (!cid.assertAttributeValue('role', 'Admin')) {
            throw new Error('the submitter must be a Admin');
        }

        const ingredientLotAsString = await this._GetItem(ctx, types.INGREDIENT, ingredientLotId);
        if (ingredientLotAsString.length === 0 || !ingredientLotAsString) {
            throw new Error(`ingredient with id ${ingredientLotId} does not exist`);
        }

        const ingredientLot = JSON.parse(ingredientLotAsString);

        // Submitter must belong to the organization that created the ingredient
        if (ctx.clientIdentity.getMSPID() !== ingredientLot.producerId) {
            throw new Error('only users of the organization which produced the ingredient can delete it');
        }

        // Delete the ingredient
        await this._DeleteItem(ctx, types.INGREDIENT, ingredientLotId);
        return `ingredient with id ${ingredientLotId} deleted`;
    }


    async UpdateIngredientLocation(ctx, id, newLocationId) {
        await this._UpdateItemLocation(ctx, types.INGREDIENT, id, newLocationId);
        return `location of item with id ${id} changed`;
    }


    async UpdateIngredientParameters(ctx, id) {
        await this._UpdateItemParameters(ctx, types.INGREDIENT, id);
        return `parameters of item with id ${id} changed`;
    }


    async CreateLocation(ctx, locationId, name, type, latitude, longitude, parameters) {
        const cid = this._GetClientIdentity(ctx);

        if (!cid.assertAttributeValue('role', 'Producer') &&
            !cid.assertAttributeValue('role', 'Manufacturer') &&
            !cid.assertAttributeValue('role', 'Courier') &&
            !cid.assertAttributeValue('role', 'Client')) {
            throw new Error('the submitter must be a Producer, Manufacturer, Courier or Client');
        }

        // Check if the ingredient lot already exists
        const locationAsString = await this.GetLocation(ctx, locationId);
        if (locationAsString.length > 0) {
            throw new Error(`location with id ${locationId} already exists`);
        }

        // Create ingredient
        const location = {
            docType: types.LOCATION,
            id: locationId,
            name: name,
            type: type,
            latitude: latitude,
            longitude: longitude,
            holderId: ctx.clientIdentity.getMSPID(),
            parameters: JSON.parse(parameters)
        };

        // Create unique key for putting the state
        const key = await ctx.stub.createCompositeKey(index, [location.docType, location.id]);
        await ctx.stub.putState(Str2Hex(key), Buffer.from(JSON.stringify(location)));

        // Create empty entry in database to perform rich queries
        await ctx.stub.putState(key, Buffer.from('\u0000'));

        return JSON.stringify(location);
    }

    async GetLocation(ctx, locationId) {
        return await this._GetItem(ctx, types.LOCATION, locationId);
    }

    async UpdateLocationParameters(ctx, id, newParameters) {
        const cid = this._GetClientIdentity(ctx);
        if (!cid.assertAttributeValue('role', 'Producer') &&
            !cid.assertAttributeValue('role', 'Manufacturer') &&
            !cid.assertAttributeValue('role', 'Courier') &&
            !cid.assertAttributeValue('role', 'Client')) {
            throw new Error('the submitter must be a Producer, Manufacturer, Client or Courier');
        }

        const locAsString = await this.GetLocation(ctx, id);
        if (!locAsString || locAsString.length === 0) {
            throw new Error(`item of type ${types.LOCATION} with id ${id} does not exist`);
        }

        const location = JSON.parse(locAsString);

        // HolderID must match submitter ID

        if (ctx.clientIdentity.getMSPID() !== location.holderId) {
            throw new Error('participant is not the holder of the item');
        }

        location.parameters = JSON.parse(newParameters);

        const key = await ctx.stub.createCompositeKey(index, [types.LOCATION, id]);
        await ctx.stub.putState(Str2Hex(key), Buffer.from(JSON.stringify(location)));
        return `parameters of location with id ${id} changed`;
    }

    async UpdateLocationCoordinates(ctx, id, latitude, longitude) {
        const cid = this._GetClientIdentity(ctx);
        if (!cid.assertAttributeValue('role', 'Producer') &&
            !cid.assertAttributeValue('role', 'Manufacturer') &&
            !cid.assertAttributeValue('role', 'Courier') &&
            !cid.assertAttributeValue('role', 'Client')) {
            throw new Error('the submitter must be a Producer, Manufacturer, Client or Courier');
        }

        const locAsString = await this.GetLocation(ctx, id);
        if (!locAsString || locAsString.length === 0) {
            throw new Error(`item of type ${types.LOCATION} with id ${id} does not exist`);
        }

        const location = JSON.parse(locAsString);

        // HolderID must match submitter ID

        if (ctx.clientIdentity.getMSPID() !== location.holderId) {
            throw new Error('participant is not the holder of the item');
        }

        if (location.type !== 'VEHICLE') {
            throw new Error('location must be a vehicle');
        }

        location.latitude = latitude;
        location.longitude = longitude;

        const key = await ctx.stub.createCompositeKey(index, [types.LOCATION, id]);
        await ctx.stub.putState(Str2Hex(key), Buffer.from(JSON.stringify(location)));
        return `parameters of location with id ${id} changed`;
    }


    async StartShipment(ctx, itemId, itemType, courierId, locationId, destinationId) {
        // The submitter must be a Producer or Manufacturer
        const mspID = this._GetClientMSPID(ctx);
        const cid = this._GetClientIdentity(ctx);


        if (mspID !== 'agr1MSP' && mspID !== 'floretteMSP') { throw new Error('submitter must be from agr1MSP or floretteMSP'); }

        if (!cid.assertAttributeValue('role', 'Producer') && !cid.assertAttributeValue('role', 'Manufacturer')) {
            throw new Error('submitter must be a Producer or Manufacturer');
        }


        // Courier ID must be valid
        if (courierId !== 'courier1MSP' && courierId !== 'courier2MSP') {
            throw new Error('invalid courier ID');
        }

        if (itemType === '') { throw new Error('invalid item type'); }

        const locAsString = await this.GetLocation(ctx, locationId);
        if (!locAsString || locAsString.length === 0) {
            throw new Error(`location with id ${locationId} does not exist`);
        }

        const destAsString = await this.GetLocation(ctx, destinationId);
        if (!destAsString || destAsString.length === 0) {
            throw new Error(`location with id ${destinationId} does not exist`);
        }

        // Get item
        const itemAsString = await this._GetItemStatus(ctx, itemType, itemId);
        if (!itemAsString || itemAsString.length === 0) {
            throw new Error(`${itemType} with id ${itemId} does not exist`);
        }

        const item = JSON.parse(itemAsString);

        // Caller must be the holder of the item
        if (mspID !== item.holderId) {
            throw new Error('current participant is not the holder of the item');
        }

        // Item must be IDLE or VALIDATED
        if (item.status !== status.IDLE && item.status !== status.VALIDATED) {
            throw new Error('item not idle');
        }

        // Modify item values
        item.holderId = courierId;
        item.status = status.IN_TRANSIT;
        item.locationId = locationId;
        item.destinationId = destinationId;


        const key = await ctx.stub.createCompositeKey(index, [itemType, itemId, 'STATUS']);
        await ctx.stub.putState(Str2Hex(key), Buffer.from(JSON.stringify(item)));

        return JSON.stringify(item);
    }



    // TODO: Get somehow the type of the item to generate the composite key
    async ShipmentStep(ctx, itemId, itemType, courierId, locationId) {
        // The submitter must be a Courier
        const mspID = this._GetClientMSPID(ctx);
        const cid = this._GetClientIdentity(ctx);

        if (mspID !== 'courier1MSP' && mspID !== 'courier2MSP') {
            throw new Error('participant must be a courier');
        }

        if (!cid.assertAttributeValue('role', 'Courier')) {
            throw new Error('The submitter must be a Courier');
        }

        // Courier ID must be valid
        if (courierId !== 'courier1MSP' && courierId !== 'courier2MSP') {
            throw new Error('invalid courier ID');
        }

        const locAsString = await this.GetLocation(ctx, locationId);
        if (!locAsString || locAsString.length === 0) {
            throw new Error(`location with id ${locationId} does not exist`);
        }

        // Verify the type
        if (itemType !== types.INGREDIENT && itemType !== types.PRODUCT) {
            throw new Error(`type must be ${types.INGREDIENT} or ${types.PRODUCT}`);
        }

        const itemAsString = await this._GetItemStatus(ctx, itemType, itemId);
        if (!itemAsString || itemAsString.length === 0) {
            throw new Error(`item with id ${itemId} and type ${itemType} does not exist`);
        }

        const item = JSON.parse(itemAsString);

        // Caller must be the holder of the item
        if (mspID !== item.holderId) {
            throw new Error('current participant is not the holder of the item');
        }

        // Item must be in transit
        if (item.status !== status.IN_TRANSIT) {
            throw new Error('item not in transit');
        }

        // Next courier must be different from the current holder of the asset
        if (item.holderId === courierId) {
            throw new Error('holder and new courier are the same organization');
        }

        // Change the holder ID
        item.holderId = courierId;
        item.locationId = locationId;

        const key = await ctx.stub.createCompositeKey(index, [itemType, itemId, 'STATUS']);
        await ctx.stub.putState(Str2Hex(key), Buffer.from(JSON.stringify(item)));


        return JSON.stringify(item);
    }



    async FinishShipment(ctx, itemId, itemType, holderId, locationId) {
        // The submitter must be a Courier
        const mspID = this._GetClientMSPID(ctx);
        const cid = this._GetClientIdentity(ctx);

        if (mspID !== 'courier1MSP' && mspID !== 'courier2MSP') {
            throw new Error('participant must be a courier');
        }

        if (!cid.assertAttributeValue('role', 'Courier')) {
            throw new Error('The submitter must be a Courier');
        }

        // holderId must be valid
        if (holderId !== 'agr1MSP' && holderId !== 'floretteMSP' && holderId !== 'retailerMSP') {
            throw new Error('invalid holder ID');
        }

        const locAsString = await this.GetLocation(ctx, locationId);
        if (!locAsString || locAsString.length === 0) {
            throw new Error(`location with id ${locationId} does not exist`);
        }

        if (itemType === '') {
            throw new Error('empty item type');
        }

        const itemAsString = await this._GetItemStatus(ctx, itemType, itemId);
        if (!itemAsString || itemAsString.length === 0) {
            throw new Error(`item with id ${itemId} and type ${itemType} does not exist`);
        }

        const item = JSON.parse(itemAsString);

        // Caller must be the holder of the item
        if (mspID !== item.holderId) {
            throw new Error('current participant is not the holder of the item');
        }

        // Item must be in transit
        if (item.status !== status.IN_TRANSIT) {
            throw new Error('item not in transit');
        }

        item.status = status.DELIVERED;
        item.holderId = holderId;
        item.locationId = locationId;

        const key = await ctx.stub.createCompositeKey(index, [itemType, itemId, 'STATUS']);
        await ctx.stub.putState(Str2Hex(key), Buffer.from(JSON.stringify(item)));

        return JSON.stringify(item);
    }



    async ValidateFinishShipment(ctx, itemId, itemType) {
        // The submitter must be a Manufacturer or a Client
        const mspID = this._GetClientMSPID(ctx);
        const cid = this._GetClientIdentity(ctx);

        if (mspID !== 'floretteMSP' && mspID !== 'retailerMSP') {
            throw new Error('participant must be from floretteMSP or retailerMSP');
        }

        if (!cid.assertAttributeValue('role', 'Manufacturer') &&
            !cid.assertAttributeValue('role', 'Client')) {
            throw new Error('the submitter must be a Manufacturer or a Client');
        }

        if (itemType === '') {
            throw new Error('empty item type');
        }


        const itemAsString = await this._GetItemStatus(ctx, itemType, itemId);
        if (!itemAsString || itemAsString.length === 0) {
            throw new Error(`item with id ${itemId} and type ${itemType} does not exist`);
        }

        const item = JSON.parse(itemAsString);


        // Caller must be the holder of the item
        if (mspID !== item.holderId) {
            throw new Error('current participant is not the holder of the item');
        }

        //The item must be delivered
        if (item.status !== status.DELIVERED) {
            throw new Error(`item with id ${itemId} is not delivered`);
        }

        if(item.locationId !== item.destinationId) {
            throw new Error(`item with id ${itemId} is not at the correct destination`);
        }

        // Set status to validated
        item.status = status.VALIDATED;

        const key = await ctx.stub.createCompositeKey(index, [itemType, itemId, 'STATUS']);
        await ctx.stub.putState(Str2Hex(key), Buffer.from(JSON.stringify(item)));

        return JSON.stringify(item);
    }




    async ManufactureProductLot(ctx, id, name, description, ingredientsId, lot, locationId, parameters) {
        const cid = await this._GetClientIdentity(ctx);
        const mspID = this._GetClientMSPID(ctx);

        if (mspID !== 'floretteMSP') {
            throw new Error('participant must be from floretteMSP ');
        }


        if (!cid.assertAttributeValue('role', 'Manufacturer')) {
            throw new Error('the submitter must be a Manufacturer');
        }

        const ingredientsArray = JSON.parse(ingredientsId).array;

        // Check that there are no empty ingredients
        if (ingredientsArray.length === 0) {
            throw new Error('no ingredients were given');
        }


        // Check that there are not products with this id
        const p = await this.GetProduct(ctx, id);
        if (p.length > 0) {
            throw new Error(`there is already a product with id ${id}`);
        }



        // create Product
        let productLot = {
            docType: types.PRODUCT,
            id: id,
            name: name,
            description: description,
            lot: lot,
            manufacturerId: mspID,
            ingredients: []
        };

        let state = {
            active: true,
            status: status.IDLE,
            holderId: mspID,
            locationId: locationId,
            parameters: JSON.parse(parameters)
        };

        // First we check if all the ingredients are valid, then we changed their status
        const ingredientsAsList = [];

        for (let i = 0; i < ingredientsArray.length; i++) {
            const ingredientId = ingredientsArray[i];
            const ingredientAsString = await this._GetItemStatus(ctx, types.INGREDIENT, ingredientId);

            if (!ingredientAsString || ingredientAsString.length === 0) {
                throw new Error(`ingredient with id ${ingredientId} does not exist`);
            }

            const ingredient = JSON.parse(ingredientAsString);

            // The ingredient must be in the same location of the product
            if (ingredient.locationId !== locationId) {
                throw new Error('ingredient is not at the location');
            }

            //The ingredient must be delivered to be manufactured
            if (ingredient.status !== status.VALIDATED) {
                throw new Error('ingredient is not validated');
            }


            // The holder of the ingredient must be the participant trying to do the transaction
            if (mspID !== ingredient.holderId) {
                throw new Error('current participant is not the holder of the item');
            }

            productLot.ingredients.push(ingredientId);
            ingredient.status = status.CONSUMED;

            ingredientsAsList.push([ingredientId, ingredient]);
        }


        // After checking that all the ingredients are valid, we update their state.
        for (let i = 0; i < ingredientsAsList.length; i++) {
            const data = ingredientsAsList[i];

            const ingredientKey = await ctx.stub.createCompositeKey(index, [types.INGREDIENT, data[0], 'STATUS']);
            await ctx.stub.putState(Str2Hex(ingredientKey), Buffer.from(JSON.stringify(data[1])));
        }

        // Store product state
        const productKey = await ctx.stub.createCompositeKey(index, [productLot.docType, productLot.id]);
        await ctx.stub.putState(Str2Hex(productKey), Buffer.from(JSON.stringify(productLot)));

        const productKey2 = await ctx.stub.createCompositeKey(index, [productLot.docType, productLot.id, 'STATUS']);
        await ctx.stub.putState(Str2Hex(productKey2), Buffer.from(JSON.stringify(state)));

        return JSON.stringify(productLot);
    }


    async GetProduct(ctx, productId) {
        return await this._GetItem(ctx, types.PRODUCT, productId);
    }

    async GetProductStatus(ctx, productId) {
        return await this._GetItemStatus(ctx, types.PRODUCT, productId);
    }

    async ListProducts(ctx, pageSize, bookmark) {
        // Submitter must be a 'Manufacturer'
        const cid = this._GetClientIdentity(ctx);
        const mspID = this._GetClientMSPID(ctx);

        if (mspID !== 'floretteMSP') {
            throw new Error('submitter must be from floretteMSP');
        }

        if (!cid.assertAttributeValue('role', 'Manufacturer')) {
            throw new Error('the submitter must be a Manufacturer');
        }

        // List items
        return await this._ListItems(ctx, types.PRODUCT, pageSize, bookmark);
    }


    async GetHistoricalDataProduct(ctx, productLotId) {
        const key = await ctx.stub.createCompositeKey(index, [types.PRODUCT, productLotId, 'STATUS']);
        const iterator = await ctx.stub.getHistoryForKey(Str2Hex(key));

        return await this._GetAllResults(iterator, true);
    }



    async UpdateProductLocation(ctx, productId, locationId) {
        await this._UpdateItemLocation(ctx, types.PRODUCT, productId, locationId);
        return `location of item with id ${productId} changed`;
    }


    async UpdateProductParameters(ctx, id) {
        await this._UpdateItemParameters(ctx, types.PRODUCT, id);
        return `parameters of item with id ${id} changed`;
    }


    async InvalidateItem(ctx, itemId, itemType) {
        // The submitter must be a Producer or Manufacturer
        const cid = this._GetClientIdentity(ctx);
        const mspID = this._GetClientMSPID(ctx);

        if (mspID !== 'floretteMSP' && mspID !== 'agr1MSP') {
            throw new Error('submitter must be from agr1MSP or floretteMSP');
        }

        if (!cid.assertAttributeValue('role', 'Producer') &&
            !cid.assertAttributeValue('role', 'Manufacturer')) {
            throw new Error('the submitter must be a Manufacturer');
        }

        if (itemType === '') {
            throw new Error('empty item type');
        }


        const itemAsString = await this._GetItemStatus(ctx, itemType, itemId);
        if (!itemAsString || itemAsString.length === 0) {
            throw new Error(`item with id ${itemId} and type ${itemType} does not exist`);
        }

        const item = JSON.parse(itemAsString);

        if (mspID !== item.holderId) {
            throw new Error('current participant is not holder of item');
        }

        item.status = status.LOST_OR_DESTROYED;
        item.active = false;

        const key = await ctx.stub.createCompositeKey(index, [itemType, itemId, 'STATUS']);
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(item)));


        return JSON.stringify(item);
    }




    /**************************
   *
   * Internal functions
   *
   * ************************/

    _GetClientIdentity(ctx) {
        return new ClientIdentity(ctx.stub);
    }


    _GetClientMSPID(ctx) {
        return ctx.clientIdentity.getMSPID();
    }



    async _GetItem(ctx, type, id) {
        const key = await ctx.stub.createCompositeKey(index, [type, id]);
        const item = await ctx.stub.getState(Str2Hex(key));
        return item.toString();
    }

    async _GetItemStatus(ctx, type, id) {
        const key = await ctx.stub.createCompositeKey(index, [type, id, 'STATUS']);
        const item = await ctx.stub.getState(Str2Hex(key));
        return item.toString();
    }

    async _DeleteItem(ctx, type, id) {
        const key = await ctx.stub.createCompositeKey(index, [type, id]);
        await ctx.stub.deleteState(Str2Hex(key));
        const key2 = await ctx.stub.createCompositeKey(index, [type, id, 'STATUS']);
        await ctx.stub.deleteState(Str2Hex(key2));
    }



    async _ListItems(ctx, type, pageSize, bookmark) {
        const queryString = JSON.stringify({
            selector: {
                docType: type
            }
        });

        const { iterator, metadata } = await ctx.stub.getQueryResultWithPagination(queryString, pageSize, bookmark);
        let results = {};

        results.results = await this._GetAllResults(iterator, false);

        results.ResponseMetadata = {
            RecordsCount: metadata.fetchedRecordsCount,
            Bookmark: metadata.bookmark,
        };

        return JSON.stringify(results);
    }


    async _UpdateItemLocation(ctx, type, id, newLocationId) {
        const itemAsString = await this._GetItemStatus(ctx, type, id);
        if (!itemAsString || itemAsString.length === 0) {
            throw new Error(`item of type ${type} with id ${id} does not exist`);
        }

        const locAsString = await this.GetLocation(ctx, newLocationId);
        if (!locAsString || locAsString.length === 0) {
            throw new Error(`location with id ${newLocationId} does not exist`);
        }

        const item = JSON.parse(itemAsString);

        // HolderID must match submitter ID
        if (ctx.clientIdentity.getMSPID() !== item.holderId) {
            throw new Error('participant is not the holder of the item');
        }

        item.locationId = newLocationId;

        const key = await ctx.stub.createCompositeKey(index, [type, id, 'STATUS']);
        await ctx.stub.putState(Str2Hex(key), Buffer.from(JSON.stringify(item)));
    }



    async _UpdateItemParameters(ctx, type, id) {
        // the submitter must be a Producer, Manufacturer, Courier or Retailer
        const cid = this._GetClientIdentity(ctx);
        if (!cid.assertAttributeValue('role', 'Producer') &&
            !cid.assertAttributeValue('role', 'Manufacturer') &&
            !cid.assertAttributeValue('role', 'Client') &&
            !cid.assertAttributeValue('role', 'Courier')) {
            throw new Error('the submitter must be a Producer, Manufacturer, Client or Courier');
        }

        const itemAsString = await this._GetItemStatus(ctx, type, id);
        if (!itemAsString || itemAsString.length === 0) {
            throw new Error(`item of type ${type} with id ${id} does not exist`);
        }

        const item = JSON.parse(itemAsString);

        const locAsString = await this.GetLocation(ctx, item.locationId);
        if (!locAsString || locAsString.length === 0) {
            throw new Error(`item of type ${types.LOCATION} with id ${item.locationId} does not exist`);
        }

        const location = JSON.parse(locAsString);

        // HolderID must match submitter ID
        if (ctx.clientIdentity.getMSPID() !== item.holderId) {
            throw new Error('participant is not the holder of the item');
        }

        if (ctx.clientIdentity.getMSPID() !== location.holderId) {
            throw new Error('participant is not the holder of the item');
        }

        item.parameters = location.parameters;

        const key = await ctx.stub.createCompositeKey(index, [type, id, 'STATUS']);
        await ctx.stub.putState(Str2Hex(key), Buffer.from(JSON.stringify(item)));
    }




    async _GetAllResults(iterator, isHistory) {
        let allResults = [];
        let res = await iterator.next();
        while (!res.done) {
            if (res.value && res.value.value.toString()) {
                let jsonRes = {};
                if (isHistory && isHistory === true) {
                    jsonRes.TxId = res.value.txId;
                    jsonRes.Timestamp = res.value.timestamp;
                    try {
                        jsonRes.Value = JSON.parse(res.value.value.toString());
                    } catch (err) {
                        jsonRes.Value = res.value.value.toString();
                    }
                } else {
                    jsonRes.Key = res.value.key;
                    try {
                        jsonRes.Record = JSON.parse(res.value.value.toString());
                    } catch (err) {
                        jsonRes.Record = res.value.value.toString();
                    }
                }
                allResults.push(jsonRes);
            }
            res = await iterator.next();
        }
        //iterator.close();
        return JSON.stringify(allResults);
    }


    async _GetQueryResultForQueryString(ctx, queryString) {
        let resultsIterator = await ctx.stub.getQueryResult(queryString);
        return await this._GetAllResults(resultsIterator, false);
    }



}


module.exports = Chaincode;