// Importing required AWS SDK v3 modules and commands
const {ECRClient, BatchGetImageCommand, PutImageCommand, BatchDeleteImageCommand} = require("@aws-sdk/client-ecr");
const core = require('@actions/core'); // Assuming @actions/core is used for GitHub Actions

// Function to extract inputs from GitHub Actions or hardcoded values
const extractInputs = () => {

    const sourceTag = core.getInput('source-tag');
    const targetTag = core.getInput('target-tag');
    const currentTagValue = core.getInput('current-tag');

    if (!sourceTag || !targetTag || !currentTagValue) {
        console.error("Error: Required inputs are not set.");
        throw new Error("Required inputs are not set.");
    }

    return {sourceTag, targetTag, currentTagValue};
};

// Initialize ECR client for AWS SDK v3
const getClient = () => {
    // Hardcoded credentials for demonstration, replace with environment variables or other secure methods
    const awsAccessKeyId = core.getInput('aws-access-key-id')
    const awsSecretAccessKey = core.getInput('aws-secret-access-key')
    const region = core.getInput('region')

    return new ECRClient({
        region,
        credentials: {accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey},
    });
};

// Function to tag image with a new tag
const tagImage = async (ecrClient, repositoryName, sourceTag, targetTag) => {
    try {
        const batchGetImageCommand = new BatchGetImageCommand({
            repositoryName,
            imageIds: [{imageTag: sourceTag}],
            acceptedMediaTypes: ['application/vnd.docker.container.image.v1+json', 'application/vnd.docker.distribution.manifest.v2+json']
        });
        const response = await ecrClient.send(batchGetImageCommand);
        const imageManifest = response.images[0].imageManifest;

        const putImageCommand = new PutImageCommand({
            repositoryName,
            imageManifest,
            imageTag: targetTag,
        });
        await ecrClient.send(putImageCommand);

        console.log(`Tag '${targetTag}' added to the image in repository '${repositoryName}'.`);
    } catch (e) {
        console.error(`Error tagging image in repository '${repositoryName}, sourceTag ${sourceTag}, targetTag: ${targetTag}': ${e}`);
        throw e;
    }
};

// Function to update the current image tag
const updateCurrentImage = async (ecrClient, repositoryName, sourceTag, currentTagValue) => {
    try {
        // Delete the current tag if it exists
        await ecrClient.send(new BatchDeleteImageCommand({
            repositoryName,
            imageIds: [{imageTag: currentTagValue}],
        }));

        // Retrieve the source image manifest
        const {images} = await ecrClient.send(new BatchGetImageCommand({
            repositoryName,
            imageIds: [{imageTag: sourceTag}],
            acceptedMediaTypes: ['application/vnd.docker.container.image.v1+json', 'application/vnd.docker.distribution.manifest.v2+json']
        }));

        if (images.length === 0) {
            throw new Error(`Image with tag ${sourceTag} not found.`);
        }

        // Apply the current tag to the source image
        await ecrClient.send(new PutImageCommand({
            repositoryName,
            imageManifest: images[0].imageManifest,
            imageTag: currentTagValue,
        }));

        console.log(`Set current image '${currentTagValue}' for '${repositoryName}' on image with tag '${sourceTag}'.`);
    } catch (e) {
        console.error(`Error updating current image tag in repository '${repositoryName}': ${e}`);
        throw e;
    }
};

const main = async () => {
    const {sourceTag, targetTag, currentTagValue} = extractInputs();
    const ecrClient = getClient();
    const repoNames = core.getInput('repositories').split(',');

    for (const repoName of repoNames) {
        await tagImage(ecrClient, repoName, sourceTag, targetTag);
        await updateCurrentImage(ecrClient, repoName, sourceTag, currentTagValue);
    }
}

main().catch((e) => {
    console.error(e);
    core.setFailed(e.message);
});