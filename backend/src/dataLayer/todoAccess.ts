import * as AWS from "aws-sdk";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { Types } from 'aws-sdk/clients/s3';
import { TodoItem } from "../models/TodoItem";
import { TodoUpdate } from "../models/TodoUpdate";
import { createLogger } from "../utils/logger";

const logger = createLogger('todoAccess');

export class TodoAccess {
    constructor(
        private readonly docClient: DocumentClient = new AWS.DynamoDB.DocumentClient(),
        private readonly s3Client: Types = new AWS.S3({ signatureVersion: 'v4' }),
        private readonly todoTable = process.env.TODOS_TABLE,
        private readonly bucketName = process.env.S3_BUCKET_NAME,
        private readonly urlExpiration = process.env.SIGNED_URL_EXPIRATION) {
    }

    async getAllToDo(userId: string): Promise<TodoItem[]> {
        logger.info(`Getting all todo items for user: ${userId}`)

        const params = {
            TableName: this.todoTable,
            KeyConditionExpression: "#uid = :userId",
            ExpressionAttributeNames: {
                "#uid": "userId"
            },
            ExpressionAttributeValues: {
                ":userId": userId
            },
            ScanIndexForward: false
        };

        const result = await this.docClient.query(params).promise();
        logger.info(result)
        const items = result.Items;

        return items as TodoItem[];
    }

    async createToDo(todoItem: TodoItem): Promise<TodoItem> {
        logger.info(`Creating a new todo with id: ${todoItem.todoId} for user: ${todoItem.userId}`)

        const params = {
            TableName: this.todoTable,
            Item: todoItem,
        };

        const result = await this.docClient.put(params).promise();
        logger.info(result)

        return todoItem as TodoItem;
    }

    async deleteToDo(todoId: string, userId: string): Promise<string> {
        logger.info(`Deleting todo with id: ${todoId} for user: ${userId}`);

        const params = {
            TableName: this.todoTable,
            Key: {
                "userId": userId,
                "todoId": todoId
            },
        };

        const result = await this.docClient.delete(params).promise();
        logger.info(result)

        return "" as string;
    }

    async updateToDo(todoUpdate: TodoUpdate, todoId: string, userId: string): Promise<TodoUpdate> {
        logger.info(`Updating the todo with id: ${todoId} for user: ${userId}`)

        const params = {
            TableName: this.todoTable,
            Key: {
                "userId": userId,
                "todoId": todoId
            },
            UpdateExpression: "set #N = :name, dueDate = :dueDate, done = :done",
            ExpressionAttributeValues: {
                ":name": todoUpdate['name'],
                ":dueDate": todoUpdate['dueDate'],
                ":done": todoUpdate['done']
            },
            ExpressionAttributeNames: {
                "#N": "name",
                "dueDate": "dueDate",
                "done": "done"
            },
            ReturnValues: "NEW_VALUES:"
        };

        const result = await this.docClient.update(params).promise();
        logger.info(result)
        const attributes = result.Attributes;

        return attributes as TodoUpdate;
    }

    async generateUploadUrl(todoId: string): Promise<string> {
        logger.info(`Getting URL for todoId: ${todoId}`)

        const url = this.s3Client.getSignedUrl('putObject', {
            Bucket: this.bucketName,
            Key: todoId,
            Expires: this.urlExpiration,
        });
        logger.info(url)

        return url as string;
    }
}
