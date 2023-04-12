/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Context } = require('fabric-contract-api');
const { ChaincodeStub, ClientIdentity } = require('fabric-shim');

const { Chaincode } = require('..');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const expect = chai.expect;

chai.should();
chai.use(chaiAsPromised);

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

function Str2Hex(str) {
    return Buffer.from(str).toString('hex');
}

describe('Chaincode', () => {

    let sandbox;
    let token;
    let ctx;
    let mockStub;
    let mockClientIdentity;

    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();
        token = new Chaincode();

        ctx = sinon.createStubInstance(Context);
        mockStub = sinon.createStubInstance(ChaincodeStub);
        ctx.stub = mockStub;
        mockClientIdentity = sinon.createStubInstance(ClientIdentity);
        ctx.clientIdentity = mockClientIdentity;

        mockStub.putState.resolves('some state');
        mockStub.setEvent.returns('set event');

    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
    });

    describe('#ProduceIngredientLot', () => {

        it('should create an ingredient', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetIngredient').returns('');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id']).returns('ingredient_id');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            const response = await token.ProduceIngredientLot(ctx, 'id', 'name', 'description', 'lot', 'location', '{"parameters":"0"}');

            const ingredientLot = {
                docType: types.INGREDIENT,
                id: 'id',
                name: 'name',
                description: 'description',
                lot: 'lot',
                producerId: 'agr1MSP'
            };
            const state = {
                status: status.IDLE,
                holderId: 'agr1MSP',
                locationId: 'location',
                destinationId: {},
                active: true,
                parameters: JSON.parse('{"parameters":"0"}')
            };

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id'), Buffer.from(JSON.stringify(ingredientLot)));
            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from(JSON.stringify(state)));
            sinon.assert.calledWith(mockStub.putState, 'ingredient_id', Buffer.from('\u0000'));
            expect(response).to.equals(JSON.stringify(ingredientLot));
        });

        it('should throw an error for incorrect user', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetIngredient').returns('');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);

            await expect(token.ProduceIngredientLot(ctx, 'id', 'name', 'description', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('user msp must be agr1MSP');
        });

        it('should throw an error for incorrect role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetIngredient').returns('');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(false);

            await expect(token.ProduceIngredientLot(ctx, 'id', 'name', 'description', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('the submitter must be a Producer');
        });

        it('should throw an error for location that does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('');
            sinon.stub(token, 'GetIngredient').returns('');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);

            await expect(token.ProduceIngredientLot(ctx, 'id', 'name', 'description', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('location does not exist');
        });

        it('should throw an error for existing ingredient', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetIngredient').returns('An ingredient');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);

            await expect(token.ProduceIngredientLot(ctx, 'id', 'name', 'description', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('ingredient with id id already exists');
        });

    });

    describe('#ListIngredients', () => {

        it('should return list of ingredients', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_ListItems').returns(JSON.stringify(['list of ingredients']));
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);

            let response = await token.ListIngredients(ctx, 3, 3);

            expect(response).to.equals(JSON.stringify(['list of ingredients']));
        });

        it('should fail for the submitter not being from agr1MSP', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_ListItems').returns(JSON.stringify(['list of ingredients']));
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);

            await expect(token.ListIngredients(ctx, 3, 3))
                .to.be.rejectedWith('submitter must be from agr1MSP');
        });

        it('should fail for the submitter not being a producer', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_ListItems').returns(JSON.stringify(['list of ingredients']));
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(false);

            await expect(token.ListIngredients(ctx, 3, 3))
                .to.be.rejectedWith('the submitter must be a Producer');
        });

    });

    describe('#GetIngredient', () => {

        it('should get ingredient', async () => {
            sinon.stub(token, '_GetItem').returns('ingredient');

            let response = await token.GetIngredient(ctx, 'id');

            expect(response).to.equals('ingredient');
        });

    });

    describe('#GetIngredientStatus', () => {

        it('should get ingredient status', async () => {
            sinon.stub(token, '_GetItemStatus').returns('ingredient status');

            let response = await token.GetIngredientStatus(ctx, 'id');

            expect(response).to.equals('ingredient status');
        });

    });

    describe('#GetHistoricalDataIngredient', () => {

        it('should update parameters', async () => {
            sinon.stub(token, '_GetAllResults').returns('list of ingredient status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockStub.createCompositeKey.withArgs(Str2Hex('ingredient_id_status')).returns('iterator');

            let response = await token.GetHistoricalDataIngredient(ctx, 'id');

            expect(response).to.equals('list of ingredient status');
        });

    });

    describe('#DeleteIngredient', () => {

        it('should delete an ingredient', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItem').returns('{"producerId":"agr1MSP"}');
            sinon.stub(token, '_DeleteItem').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Admin').returns(true);

            let response = await token.DeleteIngredient(ctx, 'id');

            expect(response).to.equals('ingredient with id id deleted');
        });

        it('should throw an error for incorrect user', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItem').returns('{"producerId":"agr1MSP"}');
            sinon.stub(token, '_DeleteItem').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Admin').returns(true);

            await expect(token.DeleteIngredient(ctx, 'id'))
                .to.be.rejectedWith('submitter must be from agr1MSP');
        });

        it('should throw an error for incorrect role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItem').returns('{"producerId":"agr1MSP"}');
            sinon.stub(token, '_DeleteItem').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Admin').returns(false);

            await expect(token.DeleteIngredient(ctx, 'id'))
                .to.be.rejectedWith('the submitter must be a Admin');
        });

        it('should throw an error for incorrect role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItem').returns('');
            sinon.stub(token, '_DeleteItem').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Admin').returns(true);

            await expect(token.DeleteIngredient(ctx, 'id'))
                .to.be.rejectedWith('ingredient with id id does not exist');
        });

        it('should throw an error for incorrect role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItem').returns('{"producerId":"agr2MSP"}');
            sinon.stub(token, '_DeleteItem').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Admin').returns(true);

            await expect(token.DeleteIngredient(ctx, 'id'))
                .to.be.rejectedWith('only users of the organization which produced the ingredient can delete it');
        });

    });

    describe('#UpdateIngredientLocation', () => {

        it('should update location', async () => {
            sinon.stub(token, '_UpdateItemLocation').returns(true);

            let response = await token.UpdateIngredientLocation(ctx, 'id', 'newLocation');

            expect(response).to.equals('location of item with id id changed');
        });

    });

    describe('#UpdateIngredientParameters', () => {

        it('should update parameters', async () => {
            sinon.stub(token, '_UpdateItemParameters').returns(true);

            let response = await token.UpdateIngredientParameters(ctx, 'id');

            expect(response).to.equals('parameters of item with id id changed');
        });

    });

    describe('#CreateLocation', () => {

        it('should create a location', async () => {
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.CreateLocation(ctx, 'id', 'name', 'type', 'latitude', 'longitude', '{"parameters":"0"}');

            const location = {
                docType: types.LOCATION,
                id: 'id',
                name: 'name',
                type: 'type',
                latitude: 'latitude',
                longitude: 'longitude',
                holderId: ctx.clientIdentity.getMSPID(),
                parameters: JSON.parse('{"parameters":"0"}')
            };

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from(JSON.stringify(location)));
            sinon.assert.calledWith(mockStub.putState, 'location_id', Buffer.from('\u0000'));
            expect(response).to.equals(JSON.stringify(location));
        });

        it('should create a location', async () => {
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.CreateLocation(ctx, 'id', 'name', 'type', 'latitude', 'longitude', '{"parameters":"0"}');

            const location = {
                docType: types.LOCATION,
                id: 'id',
                name: 'name',
                type: 'type',
                latitude: 'latitude',
                longitude: 'longitude',
                holderId: ctx.clientIdentity.getMSPID(),
                parameters: JSON.parse('{"parameters":"0"}')
            };

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from(JSON.stringify(location)));
            sinon.assert.calledWith(mockStub.putState, 'location_id', Buffer.from('\u0000'));
            expect(response).to.equals(JSON.stringify(location));
        });

        it('should create a location', async () => {
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.CreateLocation(ctx, 'id', 'name', 'type', 'latitude', 'longitude', '{"parameters":"0"}');

            const location = {
                docType: types.LOCATION,
                id: 'id',
                name: 'name',
                type: 'type',
                latitude: 'latitude',
                longitude: 'longitude',
                holderId: ctx.clientIdentity.getMSPID(),
                parameters: JSON.parse('{"parameters":"0"}')
            };

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from(JSON.stringify(location)));
            sinon.assert.calledWith(mockStub.putState, 'location_id', Buffer.from('\u0000'));
            expect(response).to.equals(JSON.stringify(location));
        });

        it('should create a location', async () => {
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Client').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.CreateLocation(ctx, 'id', 'name', 'type', 'latitude', 'longitude', '{"parameters":"0"}');

            const location = {
                docType: types.LOCATION,
                id: 'id',
                name: 'name',
                type: 'type',
                latitude: 'latitude',
                longitude: 'longitude',
                holderId: ctx.clientIdentity.getMSPID(),
                parameters: JSON.parse('{"parameters":"0"}')
            };

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from(JSON.stringify(location)));
            sinon.assert.calledWith(mockStub.putState, 'location_id', Buffer.from('\u0000'));
            expect(response).to.equals(JSON.stringify(location));
        });

        it('should fail for having a wrong role', async () => {
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Admin').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            await expect(token.CreateLocation(ctx, 'id', 'name', 'type', 'latitude', 'longitude', '{"parameters":"0"}'))
                .to.be.rejectedWith('the submitter must be a Producer, Manufacturer, Courier or Client');
        });

        it('should fail for existing the location', async () => {
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            await expect(token.CreateLocation(ctx, 'id', 'name', 'type', 'latitude', 'longitude', '{"parameters":"0"}'))
                .to.be.rejectedWith('location with id id already exists');
        });

    });

    describe('#GetLocation', () => {

        it('should get ingredient', async () => {
            sinon.stub(token, '_GetItem').returns('location');

            let response = await token.GetLocation(ctx, 'id');

            expect(response).to.equals('location');
        });

    });

    describe('#UpdateLocationParameters', () => {

        it('should update parameters', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":""}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.UpdateLocationParameters(ctx, 'id', '{"parameter":"1"}');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from('{"holderId":"agr1MSP","parameters":{"parameter":"1"}}'));
            expect(response).to.equals('parameters of location with id id changed');

        });

        it('should update parameters', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":""}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.UpdateLocationParameters(ctx, 'id', '{"parameter":"1"}');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from('{"holderId":"agr1MSP","parameters":{"parameter":"1"}}'));
            expect(response).to.equals('parameters of location with id id changed');

        });

        it('should update parameters', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":""}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.UpdateLocationParameters(ctx, 'id', '{"parameter":"1"}');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from('{"holderId":"agr1MSP","parameters":{"parameter":"1"}}'));
            expect(response).to.equals('parameters of location with id id changed');

        });

        it('should update parameters', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":""}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Client').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.UpdateLocationParameters(ctx, 'id', '{"parameter":"1"}');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from('{"holderId":"agr1MSP","parameters":{"parameter":"1"}}'));
            expect(response).to.equals('parameters of location with id id changed');

        });

        it('should fail for having worng role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":""}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Admin').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            await expect(token.UpdateLocationParameters(ctx, 'id', '{"parameter":"1"}'))
                .to.be.rejectedWith('the submitter must be a Producer, Manufacturer, Client or Courier');

        });

        it('should fail for having worng role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            await expect(token.UpdateLocationParameters(ctx, 'id', '{"parameter":"1"}'))
                .to.be.rejectedWith('item of type LOCATION with id id does not exist');

        });

        it('should fail for not being the holder', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"floretteMSP", "parameters":""}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            await expect(token.UpdateLocationParameters(ctx, 'id', '{"parameter":"1"}'))
                .to.be.rejectedWith('participant is not the holder of the item');

        });

    });

    describe('#UpdateLocationCoordinates', () => {

        it('should update coordinates', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "type":"VEHICLE"}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.UpdateLocationCoordinates(ctx, 'id', 'latitude', 'longitude');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from('{"holderId":"agr1MSP","type":"VEHICLE","latitude":"latitude","longitude":"longitude"}'));
            expect(response).to.equals('parameters of location with id id changed');
        });

        it('should update coordinates', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "type":"VEHICLE"}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.UpdateLocationCoordinates(ctx, 'id', 'latitude', 'longitude');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from('{"holderId":"agr1MSP","type":"VEHICLE","latitude":"latitude","longitude":"longitude"}'));
            expect(response).to.equals('parameters of location with id id changed');

        });

        it('should update coordinates', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "type":"VEHICLE"}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.UpdateLocationCoordinates(ctx, 'id', 'latitude', 'longitude');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from('{"holderId":"agr1MSP","type":"VEHICLE","latitude":"latitude","longitude":"longitude"}'));
            expect(response).to.equals('parameters of location with id id changed');

        });

        it('should update coordinates', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "type":"VEHICLE"}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Client').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            let response = await token.UpdateLocationCoordinates(ctx, 'id', 'latitude', 'longitude');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('location_id'), Buffer.from('{"holderId":"agr1MSP","type":"VEHICLE","latitude":"latitude","longitude":"longitude"}'));
            expect(response).to.equals('parameters of location with id id changed');

        });

        it('should fail for having the wrong role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "type":"VEHICLE"}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Admin').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            await expect(token.UpdateLocationCoordinates(ctx, 'id', 'latitude', 'longitude'))
                .to.be.rejectedWith('the submitter must be a Producer, Manufacturer, Client or Courier');

        });

        it('should fail for no existing the location', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            await expect(token.UpdateLocationCoordinates(ctx, 'id', 'latitude', 'longitude'))
                .to.be.rejectedWith('item of type LOCATION with id id does not exist');

        });

        it('should fail for not being the holder', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr2MSP", "type":"VEHICLE"}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            await expect(token.UpdateLocationCoordinates(ctx, 'id', 'latitude', 'longitude'))
                .to.be.rejectedWith('participant is not the holder of the item');

        });

        it('should fail for not being a vehicle', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "type":"WAREHOUSE"}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.LOCATION, 'id']).returns('location_id');

            await expect(token.UpdateLocationCoordinates(ctx, 'id', 'latitude', 'longitude'))
                .to.be.rejectedWith('location must be a vehicle');

        });

    });

    describe('#StartShipment', () => {

        it('should start a shipment', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP","status":"IDLE"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            let response = await token.StartShipment(ctx, 'id', 'INGREDIENT', 'courier1MSP', 'location', 'destination');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"courier1MSP","status":"IN_TRANSIT","locationId":"location","destinationId":"destination"}'));
            expect(response).to.equals('{"holderId":"courier1MSP","status":"IN_TRANSIT","locationId":"location","destinationId":"destination"}');
        });

        it('should start a shipment', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"VALIDATED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            let response = await token.StartShipment(ctx, 'id', 'INGREDIENT', 'courier2MSP', 'location', 'destination');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"courier2MSP","status":"IN_TRANSIT","locationId":"location","destinationId":"destination"}'));
            expect(response).to.equals('{"holderId":"courier2MSP","status":"IN_TRANSIT","locationId":"location","destinationId":"destination"}');
        });

        it('should fail for wrong submitter', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier1MSP","status":"VALIDATED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.StartShipment(ctx, 'id', 'INGREDIENT', 'courier2MSP', 'location', 'destination'))
                .to.be.rejectedWith('submitter must be from agr1MSP or floretteMSP');
        });

        it('should fail for wrong role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"VALIDATED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.StartShipment(ctx, 'id', 'INGREDIENT', 'courier2MSP', 'location', 'destination'))
                .to.be.rejectedWith('submitter must be a Producer or Manufacturer');
        });

        it('should fail for wrong role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"VALIDATED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.StartShipment(ctx, 'id', 'INGREDIENT', 'courier3MSP', 'location', 'destination'))
                .to.be.rejectedWith('invalid courier ID');
        });

        it('should fail for invalid item type', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"VALIDATED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.StartShipment(ctx, 'id', '', 'courier2MSP', 'location', 'destination'))
                .to.be.rejectedWith('invalid item type');
        });

        it('should fail for location does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, 'GetLocation').withArgs(ctx, 'location').returns('').withArgs(ctx, 'destination').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"VALIDATED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.StartShipment(ctx, 'id', 'INGREDIENT', 'courier2MSP', 'location', 'destination'))
                .to.be.rejectedWith('location with id location does not exist');
        });

        it('should fail for destination does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, 'GetLocation').withArgs(ctx, 'location').returns('L01').withArgs(ctx, 'destination').returns('');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"VALIDATED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.StartShipment(ctx, 'id', 'INGREDIENT', 'courier2MSP', 'location', 'destination'))
                .to.be.rejectedWith('location with id destination does not exist');
        });

        it('should fail for no existing the item', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.StartShipment(ctx, 'id', 'INGREDIENT', 'courier2MSP', 'location', 'destination'))
                .to.be.rejectedWith('INGREDIENT with id id does not exist');
        });

        it('should fail for not being the holder', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier1MSP","status":"VALIDATED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.StartShipment(ctx, 'id', 'INGREDIENT', 'courier2MSP', 'location', 'destination'))
                .to.be.rejectedWith('current participant is not the holder of the item');
        });

        it('should fail for wrong status of item', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"CONSUMED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.StartShipment(ctx, 'id', 'INGREDIENT', 'courier2MSP', 'location', 'destination'))
                .to.be.rejectedWith('item not idle');
        });

    });

    describe('#ShipmentStep', () => {

        it('should make a shipment step', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier1MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            let response = await token.ShipmentStep(ctx, 'id', 'INGREDIENT', 'courier2MSP', 'destination');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"courier2MSP","status":"IN_TRANSIT","locationId":"destination"}'));
            expect(response).to.equals('{"holderId":"courier2MSP","status":"IN_TRANSIT","locationId":"destination"}');
        });

        it('should make a shipment step', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier2MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier2MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            let response = await token.ShipmentStep(ctx, 'id', 'PRODUCT', 'courier1MSP', 'destination');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('product_id_status'), Buffer.from('{"holderId":"courier1MSP","status":"IN_TRANSIT","locationId":"destination"}'));
            expect(response).to.equals('{"holderId":"courier1MSP","status":"IN_TRANSIT","locationId":"destination"}');
        });

        it('should fail because participant must be a courier', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier2MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            await expect(token.ShipmentStep(ctx, 'id', 'PRODUCT', 'courier1MSP', 'destination'))
                .to.be.rejectedWith('participant must be a courier');
        });

        it('should fail because The submitter must be a Courier', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier2MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier2MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            await expect(token.ShipmentStep(ctx, 'id', 'PRODUCT', 'courier1MSP', 'destination'))
                .to.be.rejectedWith('The submitter must be a Courier');
        });

        it('should fail because invalid courier ID', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier2MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier2MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            await expect(token.ShipmentStep(ctx, 'id', 'PRODUCT', 'courier3MSP', 'destination'))
                .to.be.rejectedWith('invalid courier ID');
        });

        it('should fail because location does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier2MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier2MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            await expect(token.ShipmentStep(ctx, 'id', 'PRODUCT', 'courier1MSP', 'destination'))
                .to.be.rejectedWith('location with id destination does not exist');
        });

        it('should fail because type must be INGREDIENT or PRODUCT', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier2MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier2MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            await expect(token.ShipmentStep(ctx, 'id', 'LOCATION', 'courier1MSP', 'destination'))
                .to.be.rejectedWith('type must be INGREDIENT or PRODUCT');
        });

        it('should fail because item does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier2MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            await expect(token.ShipmentStep(ctx, 'id', 'PRODUCT', 'courier1MSP', 'destination'))
                .to.be.rejectedWith('item with id id and type PRODUCT does not exist');
        });

        it('should fail because current participant is not the holder of the item', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier2MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier1MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            await expect(token.ShipmentStep(ctx, 'id', 'PRODUCT', 'courier1MSP', 'destination'))
                .to.be.rejectedWith('current participant is not the holder of the item');
        });

        it('should fail because item not in transit', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier2MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier2MSP","status":"CONSUMED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            await expect(token.ShipmentStep(ctx, 'id', 'PRODUCT', 'courier1MSP', 'destination'))
                .to.be.rejectedWith('item not in transit');
        });

        it('should fail because holder and new courier are the same organization', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier2MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier2MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            await expect(token.ShipmentStep(ctx, 'id', 'PRODUCT', 'courier2MSP', 'destination'))
                .to.be.rejectedWith('holder and new courier are the same organization');
        });

    });

    describe('#FinishShipment', () => {

        it('should finish a shipment', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier2MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier2MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier2MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            let response = await token.FinishShipment(ctx, 'id', 'INGREDIENT', 'floretteMSP', 'destination');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"floretteMSP","status":"DELIVERED","locationId":"destination"}'));
            expect(response).to.equals('{"holderId":"floretteMSP","status":"DELIVERED","locationId":"destination"}');
        });

        it('should finish a shipment', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier1MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            let response = await token.FinishShipment(ctx, 'id', 'INGREDIENT', 'retailerMSP', 'destination');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"retailerMSP","status":"DELIVERED","locationId":"destination"}'));
            expect(response).to.equals('{"holderId":"retailerMSP","status":"DELIVERED","locationId":"destination"}');
        });

        it('should fail because participant must be a courier', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.FinishShipment(ctx, 'id', 'INGREDIENT', 'retailerMSP', 'destination'))
                .to.be.rejectedWith('participant must be a courier');
        });

        it('should fail because The submitter must be a Courier', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Admin').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier1MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.FinishShipment(ctx, 'id', 'INGREDIENT', 'retailerMSP', 'destination'))
                .to.be.rejectedWith('The submitter must be a Courier');
        });

        it('should fail because invalid holder ID', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier1MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.FinishShipment(ctx, 'id', 'INGREDIENT', 'courier1MSP', 'destination'))
                .to.be.rejectedWith('invalid holder ID');
        });

        it('should fail because location does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier1MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.FinishShipment(ctx, 'id', 'INGREDIENT', 'floretteMSP', 'destination'))
                .to.be.rejectedWith('location with id destination does not exist');
        });

        it('should fail because empty item type', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier1MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.FinishShipment(ctx, 'id', '', 'floretteMSP', 'destination'))
                .to.be.rejectedWith('empty item type');
        });

        it('should fail because item does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.FinishShipment(ctx, 'id', 'INGREDIENT', 'floretteMSP', 'destination'))
                .to.be.rejectedWith('item with id id and type INGREDIENT does not exist');
        });

        it('should fail because current participant is not the holder of the item', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier2MSP","status":"IN_TRANSIT"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.FinishShipment(ctx, 'id', 'INGREDIENT', 'floretteMSP', 'destination'))
                .to.be.rejectedWith('current participant is not the holder of the item');
        });

        it('should fail because item not in transit', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courier1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('courier1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"courier1MSP","status":"CONSUMED"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.FinishShipment(ctx, 'id', 'INGREDIENT', 'floretteMSP', 'destination'))
                .to.be.rejectedWith('item not in transit');
        });

    });

    describe('#ValidateFinishShipment', () => {

        it('should validate a shipment', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"DELIVERED","locationId":"destination","destinationId":"destination"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            let response = await token.ValidateFinishShipment(ctx, 'id', 'INGREDIENT');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"floretteMSP","status":"VALIDATED","locationId":"destination","destinationId":"destination"}'));
            expect(response).to.equals('{"holderId":"floretteMSP","status":"VALIDATED","locationId":"destination","destinationId":"destination"}');
        });

        it('should validate a shipment', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('retailerMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('retailerMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Client').returns(true);
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"retailerMSP","status":"DELIVERED","locationId":"destination","destinationId":"destination"}');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            let response = await token.ValidateFinishShipment(ctx, 'id', 'INGREDIENT');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"retailerMSP","status":"VALIDATED","locationId":"destination","destinationId":"destination"}'));
            expect(response).to.equals('{"holderId":"retailerMSP","status":"VALIDATED","locationId":"destination","destinationId":"destination"}');
        });

        it('should fail because participant must be from floretteMSP or retailerMSP', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP","status":"DELIVERED","locationId":"destination","destinationId":"destination"}');

            await expect(token.ValidateFinishShipment(ctx, 'id', 'INGREDIENT'))
                .to.be.rejectedWith('participant must be from floretteMSP or retailerMSP');
        });

        it('should fail because the submitter must be a Manufacturer or a Client', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"DELIVERED","locationId":"destination","destinationId":"destination"}');

            await expect(token.ValidateFinishShipment(ctx, 'id', 'INGREDIENT'))
                .to.be.rejectedWith('the submitter must be a Manufacturer or a Client');
        });

        it('should fail because empty item type', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"DELIVERED","locationId":"destination","destinationId":"destination"}');

            await expect(token.ValidateFinishShipment(ctx, 'id', ''))
                .to.be.rejectedWith('empty item type');
        });

        it('should fail because item does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, '_GetItemStatus').returns('');

            await expect(token.ValidateFinishShipment(ctx, 'id', 'INGREDIENT'))
                .to.be.rejectedWith('item with id id and type INGREDIENT does not exist');
        });

        it('should fail because current participant is not the holder of the item', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"retailerMSP","status":"DELIVERED","locationId":"destination","destinationId":"destination"}');

            await expect(token.ValidateFinishShipment(ctx, 'id', 'INGREDIENT'))
                .to.be.rejectedWith('current participant is not the holder of the item');
        });

        it('should fail because item is not delivered', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"CONSUMED","locationId":"destination","destinationId":"destination"}');

            await expect(token.ValidateFinishShipment(ctx, 'id', 'INGREDIENT'))
                .to.be.rejectedWith('item with id id is not delivered');
        });

        it('should fail because item is not at the destination', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP","status":"DELIVERED","locationId":"not destination","destinationId":"destination"}');

            await expect(token.ValidateFinishShipment(ctx, 'id', 'INGREDIENT'))
                .to.be.rejectedWith('item with id id is not at the correct destination');
        });

    });


    describe('#ManufactureProductLot', () => {

        it('should create a product', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetProduct').returns('');
            sinon.stub(token, '_GetItemStatus').returns('{"locationId":"location", "status":"VALIDATED", "holderId":"floretteMSP"}');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'I01', 'STATUS']).returns('ingredient_I01_status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP']).returns('product_idP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP', 'STATUS']).returns('product_idP_status');

            let response = await token.ManufactureProductLot(ctx, 'idP', 'name', 'description', '{"array": ["I01"]}', 'lot', 'location', '{"parameters":"0"}');

            let productLot = {
                docType: types.PRODUCT,
                id: 'idP',
                name: 'name',
                description: 'description',
                lot: 'lot',
                manufacturerId: 'floretteMSP',
                ingredients: JSON.parse('{"array": ["I01"]}').array
            };

            let state = {
                active: true,
                status: status.IDLE,
                holderId: 'floretteMSP',
                locationId: 'location',
                parameters: JSON.parse('{"parameters":"0"}')
            };

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_I01_status'), Buffer.from('{"locationId":"location","status":"CONSUMED","holderId":"floretteMSP"}'));
            sinon.assert.calledWith(mockStub.putState, Str2Hex('product_idP'), Buffer.from(JSON.stringify(productLot)));
            sinon.assert.calledWith(mockStub.putState, Str2Hex('product_idP_status'), Buffer.from(JSON.stringify(state)));
            expect(response).to.equals(JSON.stringify(productLot));
        });

        it('should throw an error for incorrect user', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetProduct').returns('');
            sinon.stub(token, '_GetItemStatus').returns('{"locationId":"location", "status":"VALIDATED", "holderId":"floretteMSP"}');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'I01', 'STATUS']).returns('ingredient_I01_status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP']).returns('product_idP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP', 'STATUS']).returns('product_idP_status');

            await expect(token.ManufactureProductLot(ctx, 'idP', 'name', 'description', '{"array": ["I01"]}', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('participant must be from floretteMSP ');
        });

        it('should throw an error for incorrect role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetProduct').returns('');
            sinon.stub(token, '_GetItemStatus').returns('{"locationId":"location", "status":"VALIDATED", "holderId":"floretteMSP"}');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(false);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'I01', 'STATUS']).returns('ingredient_I01_status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP']).returns('product_idP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP', 'STATUS']).returns('product_idP_status');

            await expect(token.ManufactureProductLot(ctx, 'idP', 'name', 'description', '{"array": ["I01"]}', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('the submitter must be a Manufacturer');
        });

        it('should throw an error for no give ingredients', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetProduct').returns('');
            sinon.stub(token, '_GetItemStatus').returns('{"locationId":"location", "status":"VALIDATED", "holderId":"floretteMSP"}');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'I01', 'STATUS']).returns('ingredient_I01_status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP']).returns('product_idP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP', 'STATUS']).returns('product_idP_status');

            await expect(token.ManufactureProductLot(ctx, 'idP', 'name', 'description', '{"array": []}', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('no ingredients were given');
        });

        it('should throw an error for existing the product', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetProduct').returns('A product');
            sinon.stub(token, '_GetItemStatus').returns('{"locationId":"location", "status":"VALIDATED", "holderId":"floretteMSP"}');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'I01', 'STATUS']).returns('ingredient_I01_status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP']).returns('product_idP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP', 'STATUS']).returns('product_idP_status');

            await expect(token.ManufactureProductLot(ctx, 'idP', 'name', 'description', '{"array": ["I01"]}', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('there is already a product with id idP');
        });

        it('should throw an error for wrong location', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetProduct').returns('');
            sinon.stub(token, '_GetItemStatus').returns('');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'I01', 'STATUS']).returns('ingredient_I01_status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP']).returns('product_idP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP', 'STATUS']).returns('product_idP_status');

            await expect(token.ManufactureProductLot(ctx, 'idP', 'name', 'description', '{"array": ["I01"]}', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('ingredient with id I01 does not exist');
        });

        it('should throw an error for wrong location', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetProduct').returns('');
            sinon.stub(token, '_GetItemStatus').returns('{"locationId":"location2", "status":"VALIDATED", "holderId":"floretteMSP"}');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'I01', 'STATUS']).returns('ingredient_I01_status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP']).returns('product_idP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP', 'STATUS']).returns('product_idP_status');

            await expect(token.ManufactureProductLot(ctx, 'idP', 'name', 'description', '{"array": ["I01"]}', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('ingredient is not at the location');
        });

        it('should throw an error for wrong ingredient status', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetProduct').returns('');
            sinon.stub(token, '_GetItemStatus').returns('{"locationId":"location", "status":"CONSUMED", "holderId":"floretteMSP"}');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'I01', 'STATUS']).returns('ingredient_I01_status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP']).returns('product_idP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP', 'STATUS']).returns('product_idP_status');

            await expect(token.ManufactureProductLot(ctx, 'idP', 'name', 'description', '{"array": ["I01"]}', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('ingredient is not validated');
        });

        it('should throw an error for wrong ingredient status', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            sinon.stub(token, 'GetProduct').returns('');
            sinon.stub(token, '_GetItemStatus').returns('{"locationId":"location", "status":"VALIDATED", "holderId":"agr1MSP"}');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'I01', 'STATUS']).returns('ingredient_I01_status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP']).returns('product_idP');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'idP', 'STATUS']).returns('product_idP_status');

            await expect(token.ManufactureProductLot(ctx, 'idP', 'name', 'description', '{"array": ["I01"]}', 'lot', 'location', '{"parameters":"0"}'))
                .to.be.rejectedWith('current participant is not the holder of the item');
        });

    });

    describe('#GetProduct', () => {

        it('should get product', async () => {
            sinon.stub(token, '_GetItem').returns('product');

            let response = await token.GetProduct(ctx, 'id');

            expect(response).to.equals('product');
        });

    });

    describe('#GetProductStatus', () => {

        it('should get product status', async () => {
            sinon.stub(token, '_GetItemStatus').returns('product status');

            let response = await token.GetProductStatus(ctx, 'id');

            expect(response).to.equals('product status');
        });

    });

    describe('#ListProducts', () => {

        it('should return list of ingredients', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_ListItems').returns(JSON.stringify(['list of products']));
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);

            let response = await token.ListProducts(ctx, 3, 3);

            expect(response).to.equals(JSON.stringify(['list of products']));
        });

        it('should fail for the submitter not being from floretteMSP', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_ListItems').returns(JSON.stringify(['list of ingredients']));
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);

            await expect(token.ListProducts(ctx, 3, 3))
                .to.be.rejectedWith('submitter must be from floretteMSP');
        });

        it('should fail for the submitter not being a manufacturer', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_ListItems').returns(JSON.stringify(['list of ingredients']));
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(false);

            await expect(token.ListProducts(ctx, 3, 3))
                .to.be.rejectedWith('the submitter must be a Manufacturer');
        });

    });

    describe('#GetHistoricalDataProduct', () => {

        it('should update parameters', async () => {
            sinon.stub(token, '_GetAllResults').returns('list of product status');
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');
            mockStub.createCompositeKey.withArgs(Str2Hex('ingredient_id_status')).returns('iterator');

            let response = await token.GetHistoricalDataProduct(ctx, 'id');

            expect(response).to.equals('list of product status');
        });

    });

    describe('#UpdateProductLocation', () => {

        it('should update location', async () => {
            sinon.stub(token, '_UpdateItemLocation').returns(true);

            let response = await token.UpdateProductLocation(ctx, 'id', 'newLocation');

            expect(response).to.equals('location of item with id id changed');
        });

    });

    describe('#UpdateProductParameters', () => {

        it('should update parameters', async () => {
            sinon.stub(token, '_UpdateItemParameters').returns(true);

            let response = await token.UpdateProductParameters(ctx, 'id');

            expect(response).to.equals('parameters of item with id id changed');
        });

    });

    describe('#InvalidateItem', () => {

        it('should invalidate an item', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItemStatus').returns(JSON.stringify({holderId: 'agr1MSP'}));
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            let response = await token.InvalidateItem(ctx, 'id', 'INGREDIENT');

            expect(response).to.equals(JSON.stringify({holderId: 'agr1MSP', status: status.LOST_OR_DESTROYED, active: false}));
        });

        it('should invalidate an item', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('floretteMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItemStatus').returns(JSON.stringify({holderId: 'floretteMSP'}));
            mockClientIdentity.getMSPID.returns('floretteMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.PRODUCT, 'id', 'STATUS']).returns('product_id_status');

            let response = await token.InvalidateItem(ctx, 'id', 'PRODUCT');

            expect(response).to.equals(JSON.stringify({holderId: 'floretteMSP', status: status.LOST_OR_DESTROYED, active: false}));
        });

        it('should throw an error for incorrect submitter', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('courierMSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItemStatus').returns(JSON.stringify({holderId: 'agr1MSP'}));
            mockClientIdentity.getMSPID.returns('courierMSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.InvalidateItem(ctx, 'id', 'INGREDIENT'))
                .to.be.rejectedWith('submitter must be from agr1MSP or floretteMSP');
        });

        it('should throw an error for incorrect role', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItemStatus').returns(JSON.stringify({holderId: 'agr1MSP'}));
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.InvalidateItem(ctx, 'id', 'INGREDIENT'))
                .to.be.rejectedWith('the submitter must be a Manufacturer');
        });

        it('should throw an error for item does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItemStatus').returns(JSON.stringify({holderId: 'agr1MSP'}));
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.InvalidateItem(ctx, 'id', ''))
                .to.be.rejectedWith('empty item type');
        });

        it('should throw an error for item does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItemStatus').returns('');
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.InvalidateItem(ctx, 'id', 'INGREDIENT'))
                .to.be.rejectedWith('item with id id and type INGREDIENT does not exist');
        });

        it('should throw an error for item does not exist', async () => {
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, '_GetItemStatus').returns(JSON.stringify({holderId: 'floretteMSP'}));
            mockClientIdentity.getMSPID.returns('agr1MSP');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await expect(token.InvalidateItem(ctx, 'id', 'INGREDIENT'))
                .to.be.rejectedWith('current participant is not holder of item');
        });

    });

    /**************************
    *
    * Internal functions
    *
    * ************************/

    //TODO: _GetClientidentity

    describe('#_GetClientMSPID', () => {

        it('should get client msp', async () => {
            mockClientIdentity.getMSPID.returns('agr1MSP');

            let response = await token._GetClientMSPID(ctx);

            expect(response).to.equals('agr1MSP');
        });

    });

    describe('#_GetItem', () => {

        it('should get an item', async () => {
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id']).returns('ingredient_id');
            mockStub.getState.withArgs(Str2Hex('ingredient_id')).returns('the ingredient');

            let response = await token._GetItem(ctx, types.INGREDIENT, 'id');

            expect(response).to.equals('the ingredient');
        });

    });

    describe('#_GetItemStatus', () => {

        it('should get item status', async () => {
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockStub.getState.withArgs(Str2Hex('ingredient_id_status')).returns('the ingredient status');

            let response = await token._GetItemStatus(ctx, types.INGREDIENT, 'id');

            expect(response).to.equals('the ingredient status');
        });

    });

    describe('#_DeleteItem', () => {

        it('should delete an item', async () => {
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id']).returns('ingredient_id');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');

            await token._DeleteItem(ctx, types.INGREDIENT, 'id');

            sinon.assert.calledWith(mockStub.deleteState, Str2Hex('ingredient_id'));
            sinon.assert.calledWith(mockStub.deleteState, Str2Hex('ingredient_id_status'));
        });

    });

    describe('#_ListItems', () => {

        it('should list items', async () => {
            const queryString = JSON.stringify({
                selector: {
                    docType: 'INGREDIENT'
                }
            });
            mockStub.getQueryResultWithPagination.withArgs(queryString, 2, 3).returns({iterator:'iterator', metadata:{fetchedRecordsCount: 6, bookmark: 3}});
            sinon.stub(token, '_GetAllResults').returns('results');

            let result = await token._ListItems(ctx, 'INGREDIENT', 2, 3);

            expect(result).to.equal('{"results":"results","ResponseMetadata":{"RecordsCount":6,"Bookmark":3}}');
        });

    });

    describe('#_UpdateItemLocation', () => {

        it('should update item location', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await token._UpdateItemLocation(ctx, 'INGREDIENT', 'id', 'newLocation');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"agr1MSP","locationId":"newLocation"}'));
        });

        it('should fail because item does not exist', async () => {
            sinon.stub(token, '_GetItemStatus').returns('');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await expect(token._UpdateItemLocation(ctx, 'INGREDIENT', 'id', 'newLocation'))
                .to.be.rejectedWith('item of type INGREDIENT with id id does not exist');
        });

        it('should fail because location does not exist', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await expect(token._UpdateItemLocation(ctx, 'INGREDIENT', 'id', 'newLocation'))
                .to.be.rejectedWith('location with id newLocation does not exist');
        });

        it('should fail because participant is not the holder of the item', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('L01');
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await expect(token._UpdateItemLocation(ctx, 'INGREDIENT', 'id', 'newLocation'))
                .to.be.rejectedWith('participant is not the holder of the item');
        });

    });

    describe('#_UpdateItemParameters', () => {

        it('should update item location', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":{"parameters":"0"}}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await token._UpdateItemParameters(ctx, 'INGREDIENT', 'id');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"agr1MSP","parameters":{"parameters":"0"}}'));
        });

        it('should update item location', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":{"parameters":"0"}}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Manufacturer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await token._UpdateItemParameters(ctx, 'INGREDIENT', 'id');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"agr1MSP","parameters":{"parameters":"0"}}'));
        });

        it('should update item location', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":{"parameters":"0"}}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Client').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await token._UpdateItemParameters(ctx, 'INGREDIENT', 'id');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"agr1MSP","parameters":{"parameters":"0"}}'));
        });

        it('should update item location', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":{"parameters":"0"}}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Courier').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await token._UpdateItemParameters(ctx, 'INGREDIENT', 'id');

            sinon.assert.calledWith(mockStub.putState, Str2Hex('ingredient_id_status'), Buffer.from('{"holderId":"agr1MSP","parameters":{"parameters":"0"}}'));
        });

        it('should fail because the submitter must be a Producer, Manufacturer, Client or Courier', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":{"parameters":"0"}}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Retailer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await expect(token._UpdateItemParameters(ctx, 'INGREDIENT', 'id'))
                .to.be.rejectedWith('the submitter must be a Producer, Manufacturer, Client or Courier');
        });

        it('should fail because item does not exist', async () => {
            sinon.stub(token, '_GetItemStatus').returns('');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"floretteMSP", "parameters":{"parameters":"0"}}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await expect(token._UpdateItemParameters(ctx, 'INGREDIENT', 'id'))
                .to.be.rejectedWith('item of type INGREDIENT with id id does not exist');
        });

        it('should fail because location does not exist', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP","locationId":"location"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await expect(token._UpdateItemParameters(ctx, 'INGREDIENT', 'id'))
                .to.be.rejectedWith('item of type LOCATION with id location does not exist');
        });

        it('should fail because participant is not the holder of the item', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"floretteMSP"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"agr1MSP", "parameters":{"parameters":"0"}}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await expect(token._UpdateItemParameters(ctx, 'INGREDIENT', 'id'))
                .to.be.rejectedWith('participant is not the holder of the item');
        });

        it('should fail because participant is not the holder of the location', async () => {
            sinon.stub(token, '_GetItemStatus').returns('{"holderId":"agr1MSP"}');
            sinon.stub(token, '_GetClientMSPID').returns('agr1MSP');
            sinon.stub(token, '_GetClientIdentity').returns(mockClientIdentity);
            sinon.stub(token, 'GetLocation').returns('{"holderId":"floretteMSP", "parameters":{"parameters":"0"}}');
            mockClientIdentity.assertAttributeValue.withArgs('role', 'Producer').returns(true);
            mockStub.createCompositeKey.withArgs('docType~id', [types.INGREDIENT, 'id', 'STATUS']).returns('ingredient_id_status');
            mockClientIdentity.getMSPID.returns('agr1MSP');

            await expect(token._UpdateItemParameters(ctx, 'INGREDIENT', 'id'))
                .to.be.rejectedWith('participant is not the holder of the item');
        });

    });

    //TODO: _GetAllResults
    describe('#_GetAllResults', () => {

        it('should get all results', async () => {
            let iterable = [{value: 0x2}, {value: 0x4}, {value: 0x6}];
            let response = await token._GetAllResults(iterable[Symbol.iterator](), false);

            expect(response).to.equals('[{"Record":2},{"Record":4},{"Record":6}]');
        });

        it('should get all results', async () => {
            let iterable = [{value: 0x2}, {value: 0x4}, {value: 0x6}];
            let response = await token._GetAllResults(iterable[Symbol.iterator](), true);

            expect(response).to.equals('[{"Value":2},{"Value":4},{"Value":6}]');
        });

    });

    describe('#_GetQueryResultForQueryString', () => {

        it('should update item location', async () => {
            sinon.stub(token, '_GetAllResults').returns('results');
            mockStub.getQueryResult.returns('iterator');

            let response = await token._GetQueryResultForQueryString(ctx, 'queryString');

            expect(response).to.equals('results');
        });

    });

});
