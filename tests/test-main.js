const AWS = require('aws-sdk');
const core = require('@actions/core');
const {extractInputs, updateCurrentImage, tagImage, main} = require('../src/index');

jest.mock('aws-sdk', () => {
    const mockECR = {
        batchGetImage: jest.fn().mockResolvedValue({
            images: [{imageId: {imageDigest: 'digest'}, imageManifest: 'manifest'}],
        }),
        batchDeleteImage: jest.fn(),
        putImage: jest.fn(),
    };

    const ECR = jest.fn().mockReturnValue(mockECR);

    return {
        ECR,
    };
});

jest.mock('@actions/core', () => ({
    getInput: jest.fn(),
}));

describe('tag-images', () => {
    // beforeEach(() => {
    //     jest.resetAllMocks();
    // });

    test('main', async () => {
        core.getInput.mockReturnValueOnce('source-tag')
            .mockReturnValueOnce('target-tag')
            .mockReturnValueOnce('current-tag')
            .mockReturnValueOnce('aws-access-key-id')
            .mockReturnValueOnce('aws-secret-access-key')
            .mockReturnValueOnce('region')
            .mockReturnValueOnce('repository1, repository2');
        await main();
        expect(AWS.ECR).toHaveBeenCalledWith({
            region: 'region',
            accessKeyId: 'aws-access-key-id',
            secretAccessKey: 'aws-secret-access-key',
        });
    });

    test('extractInputs', () => {
        core.getInput.mockReturnValue('foobar')
            .mockReturnValueOnce('source-tag')
            .mockReturnValueOnce('target-tag')
            .mockReturnValueOnce('current-tag');
        const inputs = extractInputs();
        expect(inputs).toEqual({sourceTag: 'source-tag', targetTag: 'target-tag', currentTagValue: 'current-tag'});
    });

    test('updateCurrentImage', async () => {
        const ecrClient = new AWS.ECR();
        core.getInput.mockReturnValueOnce('source-tag')
            .mockReturnValueOnce('target-tag')
            .mockReturnValueOnce('current-tag');
        ecrClient.batchGetImage.mockResolvedValue({
            images: [{imageId: {imageDigest: 'digest'}, imageManifest: 'manifest'}],
        });
        await updateCurrentImage(ecrClient, 'repository', 'source-tag', 'current-tag');
        expect(ecrClient.batchDeleteImage).toHaveBeenCalledWith({
            repositoryName: 'repository',
            imageIds: [{imageTag: 'current-tag'}],
        });
        expect(ecrClient.putImage).toHaveBeenCalledWith({
            repositoryName: 'repository',
            imageManifest: 'manifest',
            imageTag: 'current-tag',
            imageDigest: 'digest',
        });
    });

    test('tagImage', async () => {
        const ecrClient = new AWS.ECR();
        ecrClient.batchGetImage.mockResolvedValue({
            images: [{imageId: {imageDigest: 'digest'}, imageManifest: 'manifest'}],
        });
        await tagImage(ecrClient, 'repository', 'source-tag', 'target-tag');
        expect(ecrClient.putImage).toHaveBeenCalledWith({
            repositoryName: 'repository',
            imageManifest: 'manifest',
            imageTag: 'target-tag',
            imageDigest: 'digest',
        });
    });

});