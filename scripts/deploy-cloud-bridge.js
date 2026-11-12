import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PROFILE = 'default';
const REGION = 'eu-central-1';
const BUCKET = 'papoosh-bridge-904610892841';
const ROLE_NAME = 'papoosh-cloud-bridge-lambda-role';
const FUNC_NAME = 'papoosh-cloud-bridge';

function aws(cmd) {
  const full = `aws ${cmd} --profile ${PROFILE} --region ${REGION} --output json`;
  return execSync(full, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

async function main() {
  console.log('1. Ensuring S3 bucket:', BUCKET);
  try {
    aws(`s3api head-bucket --bucket ${BUCKET}`);
    console.log('   Bucket already exists.');
  } catch {
    aws(`s3api create-bucket --bucket ${BUCKET} --create-bucket-configuration LocationConstraint=${REGION}`);
    console.log('   Created bucket:', BUCKET);
  }

  // Upload initial state/bridge.json and state/telemetry.json
  const bridgeLocal = path.join(rootDir, 'public', 'data', 'bridge.json');
  const telemetryLocal = path.join(rootDir, 'public', 'data', 'telemetry.json');
  if (fs.existsSync(bridgeLocal)) {
    execSync(`aws s3 cp "${bridgeLocal}" s3://${BUCKET}/state/bridge.json --profile ${PROFILE} --region ${REGION}`, { stdio: 'inherit' });
  }
  if (fs.existsSync(telemetryLocal)) {
    execSync(`aws s3 cp "${telemetryLocal}" s3://${BUCKET}/state/telemetry.json --profile ${PROFILE} --region ${REGION}`, { stdio: 'inherit' });
  }

  console.log('2. Ensuring IAM Role:', ROLE_NAME);
  let roleArn = '';
  try {
    const r = JSON.parse(aws(`iam get-role --role-name ${ROLE_NAME}`));
    roleArn = r.Role.Arn;
    console.log('   Role exists:', roleArn);
  } catch {
    const trustPolicy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole'
        }
      ]
    });
    const trustFile = path.join(rootDir, 'scripts', 'trust-policy.json');
    fs.writeFileSync(trustFile, trustPolicy, 'utf8');
    const created = JSON.parse(
      aws(`iam create-role --role-name ${ROLE_NAME} --assume-role-policy-document file://"${trustFile}"`)
    );
    roleArn = created.Role.Arn;
    fs.unlinkSync(trustFile);

    const inlinePolicy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
          Resource: [`arn:aws:s3:::${BUCKET}`, `arn:aws:s3:::${BUCKET}/*`]
        },
        {
          Effect: 'Allow',
          Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          Resource: '*'
        }
      ]
    });
    const policyFile = path.join(rootDir, 'scripts', 'role-policy.json');
    fs.writeFileSync(policyFile, inlinePolicy, 'utf8');
    aws(`iam put-role-policy --role-name ${ROLE_NAME} --policy-name papoosh-s3-logs --policy-document file://"${policyFile}"`);
    fs.unlinkSync(policyFile);
    console.log('   Waiting 10s for IAM role propagation...');
    await new Promise((r) => setTimeout(r, 10000));
  }

  console.log('3. Packaging Lambda code...');
  const lambdaDir = path.join(rootDir, 'scripts', 'lambda-pkg');
  fs.mkdirSync(lambdaDir, { recursive: true });
  const lambdaCode = `
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: '${REGION}' });
const BUCKET = '${BUCKET}';

async function getJson(key, fallback) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const raw = await res.Body.transformToString('utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function putJson(key, obj) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(obj, null, 2),
      ContentType: 'application/json; charset=utf-8'
    })
  );
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || 'GET';
  const rawPath = event.rawPath || '/';

  if (method === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  try {
    if (method === 'GET') {
      const [bridge, telemetry] = await Promise.all([
        getJson('state/bridge.json', { messages: [], links: [], files: [] }),
        getJson('state/telemetry.json', null)
      ]);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ ok: true, bridge, telemetry })
      };
    }

    if (method === 'POST') {
      const bodyStr = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf8')
        : event.body || '{}';
      const payload = JSON.parse(bodyStr);
      const { type, text, prompt, alertId, attachments, syncState } = payload;

      // PC Daemon pushing full state update
      if (type === 'pc-sync' && syncState) {
        if (syncState.bridge) await putJson('state/bridge.json', syncState.bridge);
        if (syncState.telemetry) await putJson('state/telemetry.json', syncState.telemetry);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ ok: true })
        };
      }

      if (type === 'dismiss-alert' && alertId) {
        const telemetry = await getJson('state/telemetry.json', { alerts: [], dismissedAlertIds: [] });
        telemetry.alerts = (telemetry.alerts || []).filter((a) => a.id !== alertId);
        telemetry.dismissedAlertIds = Array.from(new Set([...(telemetry.dismissedAlertIds || []), alertId]));
        if (telemetry.summary) {
          telemetry.summary.openAlerts = telemetry.alerts.length;
        }
        await putJson('state/telemetry.json', telemetry);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ ok: true, telemetry })
        };
      }

      const bridge = await getJson('state/bridge.json', { messages: [], links: [], files: [] });
      const now = new Date().toISOString();
      const taskId = \`task-\${Date.now()}-\${Math.random().toString(36).slice(2, 6)}\`;

      const savedAttachments = [];
      if (Array.isArray(attachments) && attachments.length > 0) {
        for (const att of attachments) {
          if (!att || !att.name || !att.contentBase64) continue;
          const safeName = String(att.name).replace(/[^a-zA-Z0-9._\\u0590-\\u05FF-]/g, '_');
          const s3Key = \`files/\${Date.now()}-\${safeName}\`;
          const base64Clean = String(att.contentBase64).replace(/^data:[^;]+;base64,/, '');
          const buf = Buffer.from(base64Clean, 'base64');
          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET,
              Key: s3Key,
              Body: buf,
              ContentType: att.type || 'application/octet-stream'
            })
          );
          savedAttachments.push({
            id: \`file-\${Date.now()}-\${Math.random().toString(36).slice(2, 5)}\`,
            name: att.name,
            size: buf.length,
            type: att.type || 'application/octet-stream',
            s3Key,
            savedPath: \`C:\\\\Users\\\\fradk\\\\PROGRAMS\\\\papoosh-automations\\\\incoming-files\\\\\${safeName}\`,
            uploadedAt: now
          });
        }
      }

      const taskText = (text || prompt || '').trim();
      const displayMsg =
        taskText ||
        (savedAttachments.length > 0
          ? \`הועלו \${savedAttachments.length} קבצים לגשר: \${savedAttachments.map((f) => f.name).join(', ')}\`
          : \`הופעלה פקודה: \${type}\`);

      const userMsg = {
        id: \`msg-\${Date.now()}\`,
        taskId,
        sender: 'tal',
        target: 'agent',
        actionType: type || 'task',
        attachments: savedAttachments,
        timestamp: now,
        text: displayMsg
      };

      const ackMsg = {
        id: \`msg-ack-\${Date.now() + 1}\`,
        taskId,
        sender: 'agent',
        target: 'tal',
        status: 'pending-pc',
        timestamp: now,
        text: \`✅ הבקשה נקלטה בענן ונשלחה למחשב הנייח ולשיחה לביצוע: "\${displayMsg}"\`
      };

      if (savedAttachments.length > 0) {
        bridge.files = [...savedAttachments, ...(bridge.files || [])].slice(0, 50);
      }
      bridge.messages = [ackMsg, userMsg, ...(bridge.messages || [])].slice(0, 100);
      bridge.updatedAt = now;

      await Promise.all([
        putJson('state/bridge.json', bridge),
        putJson(\`inbox/\${taskId}.json\`, {
          taskId,
          createdAt: now,
          type: type || 'task',
          text: taskText,
          attachments: savedAttachments
        })
      ]);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ ok: true, taskId, bridge })
      };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: false, error: String(err) })
    };
  }
};
`;

  fs.writeFileSync(path.join(lambdaDir, 'index.mjs'), lambdaCode.trim() + '\n', 'utf8');
  const zipPath = path.join(rootDir, 'scripts', 'lambda-pkg.zip');
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${lambdaDir}\\*' -DestinationPath '${zipPath}' -Force"`);

  console.log('4. Deploying Lambda Function:', FUNC_NAME);
  try {
    aws(`lambda get-function --function-name ${FUNC_NAME}`);
    aws(`lambda update-function-code --function-name ${FUNC_NAME} --zip-file fileb://"${zipPath}"`);
    console.log('   Updated existing function code.');
  } catch {
    aws(
      `lambda create-function --function-name ${FUNC_NAME} --runtime nodejs20.x --role ${roleArn} --handler index.handler --timeout 30 --memory-size 256 --zip-file fileb://"${zipPath}"`
    );
    console.log('   Created new Lambda function.');
  }

  console.log('5. Configuring Lambda Function URL (HTTPS + CORS)...');
  let functionUrl = '';
  const corsConfig = JSON.stringify({
    AllowOrigins: ['*'],
    AllowMethods: ['*'],
    AllowHeaders: ['Content-Type', 'Authorization'],
    MaxAge: 86400
  });
  const corsFile = path.join(rootDir, 'scripts', 'cors.json');
  fs.writeFileSync(corsFile, corsConfig, 'utf8');

  try {
    const existingUrl = JSON.parse(aws(`lambda get-function-url-config --function-name ${FUNC_NAME}`));
    functionUrl = existingUrl.FunctionUrl;
    aws(`lambda update-function-url-config --function-name ${FUNC_NAME} --auth-type NONE --cors file://"${corsFile}"`);
  } catch {
    const createdUrl = JSON.parse(
      aws(`lambda create-function-url-config --function-name ${FUNC_NAME} --auth-type NONE --cors file://"${corsFile}"`)
    );
    functionUrl = createdUrl.FunctionUrl;
  }
  fs.unlinkSync(corsFile);

  try {
    aws(
      `lambda add-permission --function-name ${FUNC_NAME} --statement-id FunctionURLAllowPublicAccess --action lambda:InvokeFunctionUrl --principal "*" --function-url-auth-type NONE`
    );
  } catch {
    // Permission already exists
  }
  try {
    aws(
      `lambda add-permission --function-name ${FUNC_NAME} --statement-id FunctionURLAllowPublicInvoke --action lambda:InvokeFunction --principal "*" --invoked-via-function-url`
    );
  } catch {
    // Permission already exists
  }

  console.log('SUCCESS! Cloud Bridge URL:', functionUrl);
  fs.writeFileSync(
    path.join(rootDir, 'src', 'cloudBridgeConfig.js'),
    `export const CLOUD_BRIDGE_URL = '${functionUrl}';\n`,
    'utf8'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
