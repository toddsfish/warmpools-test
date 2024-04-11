import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends cdk.Stack {
  // Make VPC object readonly outside stack, creates the implicit CFN export / import, cross stack reference
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC Definition //
    this.vpc = new ec2.Vpc(this, 'vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: 3,
      maxAzs: 3,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // S3 Gateway Endpoint Definition //
    this.vpc.addGatewayEndpoint('S3GWEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // VPC Interface Endpoint Definitions //
    this.vpc.addInterfaceEndpoint('SsmInterfaceVpce', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
    });

    this.vpc.addInterfaceEndpoint('SsmMessagesInterfaceVpce', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    });

    this.vpc.addInterfaceEndpoint('Ec2MessagesInterfaceVpce', {
      service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
    });
  }
}
