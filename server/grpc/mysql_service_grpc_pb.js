// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var mysql_service_pb = require('./mysql_service_pb.js');

function serialize_grpc_AgentRequest(arg) {
  if (!(arg instanceof mysql_service_pb.AgentRequest)) {
    throw new Error('Expected argument of type grpc.AgentRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_grpc_AgentRequest(buffer_arg) {
  return mysql_service_pb.AgentRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_grpc_AgentResponse(arg) {
  if (!(arg instanceof mysql_service_pb.AgentResponse)) {
    throw new Error('Expected argument of type grpc.AgentResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_grpc_AgentResponse(buffer_arg) {
  return mysql_service_pb.AgentResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var GrpcAgentServiceService = exports.GrpcAgentServiceService = {
  invoke: {
    path: '/grpc.GrpcAgentService/invoke',
    requestStream: false,
    responseStream: false,
    requestType: mysql_service_pb.AgentRequest,
    responseType: mysql_service_pb.AgentResponse,
    requestSerialize: serialize_grpc_AgentRequest,
    requestDeserialize: deserialize_grpc_AgentRequest,
    responseSerialize: serialize_grpc_AgentResponse,
    responseDeserialize: deserialize_grpc_AgentResponse,
  }
};

exports.GrpcAgentServiceClient = grpc.makeGenericClientConstructor(GrpcAgentServiceService, 'GrpcAgentService');
