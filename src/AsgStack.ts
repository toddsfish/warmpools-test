import { readFileSync } from 'fs';
import { WarmPool } from '@pandanus-cloud/cdk-autoscaling-warmpool';
import * as cdk from 'aws-cdk-lib';
import * as as from 'aws-cdk-lib/aws-autoscaling';
import { TopicHook } from 'aws-cdk-lib/aws-autoscaling-hooktargets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

interface asgStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  albTg: elbv2.ApplicationTargetGroup;
}

export class AsgStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: asgStackProps) {
    super(scope, id, props);

    // Object destructure assignment - unpack properties of asgStackProps object each into variables of property name
    const { vpc } = props;
    const { albTg } = props;

    //SNS topic to be used to notify of scaling activities
    const asgSNSTopic = new sns.Topic(this, 'asgSNSTopic', {
      topicName: 'asgSNSTopic',
    });

    // Adding email SNS topic for testing
    asgSNSTopic.addSubscription(new EmailSubscription('hello@toddaas.com'));

    const asgRole = new iam.Role(this, 'asgRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      roleName: 'asgRole',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonEC2RoleforSSM',
        ),
      ],
    });

    // Autoscaling Group (ASG)
    const asg = new as.AutoScalingGroup(this, 'asg', {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE2,
        ec2.InstanceSize.MICRO,
      ),
      // The latest Amazon Linux image of a particular generation
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      ssmSessionPermissions: true,
      minCapacity: 3,
      maxCapacity: 6,
      desiredCapacity: 3,
      role: asgRole,
      healthCheck: as.HealthCheck.elb({
        grace: cdk.Duration.seconds(0),
      }),
      notifications: [
        {
          topic: asgSNSTopic,
        },
      ],
      autoScalingGroupName: 'asg',
      defaultInstanceWarmup: cdk.Duration.seconds(0),
    });

    //We strongly recommend that you use a target tracking scaling policy to scale on a metric like average CPU utilization or the RequestCountPerTarget metric from the Application Load Balancer.
    new as.TargetTrackingScalingPolicy(this, 'targetTrackingScaling', {
      autoScalingGroup: asg,
      targetValue: 50,
      disableScaleIn: false,
      predefinedMetric: as.PredefinedMetric.ASG_AVERAGE_CPU_UTILIZATION,
    });

    // LCH Policy - with resource level permissions required to call CompleteLifecycleAction api call on Webtier ASG
    const asgLCHookPolicy = new iam.Policy(this, 'asgLCHookPolicy', {
      policyName: 'asgLCHookPolicy',
      statements: [
        new iam.PolicyStatement({
          actions: ['autoscaling:CompleteLifecycleAction'],
          resources: [asg.autoScalingGroupArn],
        }),
      ],
    });

    // Attach the LC policy to ASG Role (Instance Role)
    asg.role.attachInlinePolicy(asgLCHookPolicy);

    // Read userdata.sh and associate this with the ASG
    const asgUserData = readFileSync('./src/userdata.sh', 'utf8');
    // Userdata just installs Apache with Hello World Page and then call complete_lifecycle_action if the Userdata automation hs run and target state of instance is InService, Warmed:Running or Warmed:Hibernated
    asg.addUserData(asgUserData);

    // Notification Role Used by LC Hook
    const asgLCHookNotifyRole = new iam.Role(this, 'asgLCHookRole', {
      assumedBy: new iam.ServicePrincipal('autoscaling.amazonaws.com'),
      roleName: 'asgLCHookRole',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AutoScalingNotificationAccessRole',
        ),
      ],
    });

    // ASG Launch LC Hook
    new as.LifecycleHook(this, 'asgLCHook', {
      autoScalingGroup: asg,
      lifecycleTransition: as.LifecycleTransition.INSTANCE_LAUNCHING,
      defaultResult: as.DefaultResult.ABANDON,
      lifecycleHookName: 'asgLCHook',
      notificationTarget: new TopicHook(asgSNSTopic),
      role: asgLCHookNotifyRole,
    });

    // Reference to the @pandanus-cloud/cdk-autoscaling-warmpool CDK Construct
    new WarmPool(this, 'warmPool', {
      asg: asg,
      // Property not required - Construct the overrides default behaviour of STOPPED to RUNNING
      state: 'RUNNING',
      // Property not required
      maxPreparedCapacity: 1,
      // Property not required
      minPoolSize: 1,
    });

    asg.attachToApplicationTargetGroup(albTg);
  }
}
