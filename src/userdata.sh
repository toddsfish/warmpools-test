 #!/bin/bash
function get_target_state {
    echo $(curl -s http://169.254.169.254/latest/meta-data/autoscaling/target-lifecycle-state)
}

function get_instance_id {
    echo $(curl -s http://169.254.169.254/latest/meta-data/instance-id)
}

function complete_lifecycle_action {
    instance_id=$(get_instance_id)
    group_name='asg'
 
    echo $instance_id
    echo $(aws autoscaling complete-lifecycle-action \
      --lifecycle-hook-name asgLCHook \
      --auto-scaling-group-name $group_name \
      --lifecycle-action-result CONTINUE \
      --region ap-southeast-2 \
      --instance-id $instance_id)
}

function main {
    yum update -y
    yum install httpd -y
    systemctl start httpd
    systemctl enable httpd
    echo "<h1>Hello World from $(hostname -f)</h1>" > /var/www/html/index.html
    echo "sleeping for 1 mins, to demonstrate if instance is put into ASG it moves first into LC Pending:Wait or if instances is launched into WARM pool - Warmed:Pending:Wait state"
    sleep 60
    while true
    do
        ## Target state will be either InService (if using just LC Hooks with ASG) OR Warmed:Running,Stopped,Hibernated (if using Warm Pools aswell)
        target_state=$(get_target_state)
        if [ \"$target_state\" = \"InService\" ] || [ \"$target_state\" = \"Warmed:Running\" ] || [ \"$target_state\" = \"Warmed:Stopped\" ] || [ \"$target_state\" = \"Warmed:Hibernated\" ]; then
            echo "Instance Bootstrapping done, complete-lifecycle-action Launching - putting instance into InService or into Warmed:Running or Warmed:Stopped state or Warmed:Hibernated if its into an ASG Warm Pool.."
            # Send callback
            complete_lifecycle_action
            break
        fi
        echo $target_state
        sleep 5
    done
}

main