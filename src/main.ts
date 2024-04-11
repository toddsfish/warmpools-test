import * as cdk from 'aws-cdk-lib';
import { AsgStack } from './AsgStack';
import { LoadBalancerStack } from './LoadBalancerStack';
import { VpcStack } from './VpcStack';

const app = new cdk.App();

// Define VPC Stack
const baseVpc = new VpcStack(app, 'baseVpc', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// Define Application Load Balancer Stack
const loadBalancer = new LoadBalancerStack(app, 'loadBalancer', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  vpc: baseVpc.vpc,
});

// Define AutoScaling Group
new AsgStack(app, 'asg', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  vpc: baseVpc.vpc,
  albTg: loadBalancer.albTg,
});

app.synth();
