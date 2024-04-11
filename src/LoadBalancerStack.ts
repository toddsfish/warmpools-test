import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface LoadBalancerStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class LoadBalancerStack extends cdk.Stack {
  // albTg readonly for use in the AsgStack for ASG to populate Target Group
  public readonly albTg: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: LoadBalancerStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // Create ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'alb', {
      loadBalancerName: 'alb',
      vpc: vpc,
      internetFacing: true,
    });

    // Create Target Group
    this.albTg = new elbv2.ApplicationTargetGroup(this, 'albTg', {
      targetGroupName: 'alb-tg',
      targetType: elbv2.TargetType.INSTANCE,
      vpc: vpc,
      port: 80,
      healthCheck: {
        port: '80',
        protocol: elbv2.Protocol.HTTP,
        path: '/',
      },
    });

    // Create ALB Listener
    alb.addListener('albListener', {
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.forward([this.albTg]),
    });
  }
}
