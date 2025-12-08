module.exports = {
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn()
    })
  },
  QueryCommand: jest.fn(),
  PutCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  GetCommand: jest.fn()
};
