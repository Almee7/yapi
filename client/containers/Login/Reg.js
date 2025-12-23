import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Form, Button, Input, Icon, message, Tooltip, Progress } from 'antd';
import { regActions } from '../../reducer/modules/user';
import { withRouter } from 'react-router';
const FormItem = Form.Item;
const formItemStyle = {
  marginBottom: '.16rem'
};

const changeHeight = {
  height: '.42rem'
};

@connect(
  state => {
    return {
      loginData: state.user
    };
  },
  {
    regActions
  }
)
@withRouter
class Reg extends Component {
  constructor(props) {
    super(props);
    this.state = {
      confirmDirty: false,
      loading: false,
      passwordStrength: 0,
      showPassword: false,
      showConfirmPassword: false
    };
  }

  static propTypes = {
    form: PropTypes.object,
    history: PropTypes.object,
    regActions: PropTypes.func
  };

  handleSubmit = e => {
    e.preventDefault();
    const form = this.props.form;
    form.validateFieldsAndScroll((err, values) => {
      if (!err) {
        this.setState({ loading: true });
        this.props.regActions(values)
          .then(res => {
            if (res.payload.data.errcode == 0) {
              message.success('注册成功!');
              setTimeout(() => {
                this.props.history.replace('/group');
              }, 500);
            } else {
              this.setState({ loading: false });
            }
          })
          .catch(() => {
            this.setState({ loading: false });
          });
      }
    });
  };

  checkPassword = (rule, value, callback) => {
    const form = this.props.form;
    if (value && value !== form.getFieldValue('password')) {
      callback('两次输入的密码不一致啊!');
    } else {
      callback();
    }
  };

  checkConfirm = (rule, value, callback) => {
    const form = this.props.form;
    if (value && this.state.confirmDirty) {
      form.validateFields(['confirm'], { force: true });
    }
    // 计算密码强度
    this.calculatePasswordStrength(value);
    callback();
  };

  calculatePasswordStrength = (password) => {
    if (!password) {
      this.setState({ passwordStrength: 0 });
      return;
    }
    let strength = 0;
    // 长度检查
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    // 包含数字
    if (/\d/.test(password)) strength += 25;
    // 包含大小写字母
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    // 包含特殊字符
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    
    this.setState({ passwordStrength: Math.min(strength, 100) });
  };

  getPasswordStrengthStatus = () => {
    const { passwordStrength } = this.state;
    if (passwordStrength >= 75) return 'success';
    if (passwordStrength >= 50) return 'normal';
    if (passwordStrength >= 25) return 'exception';
    return 'exception';
  };

  togglePasswordVisibility = (field) => {
    this.setState(prevState => ({
      [field]: !prevState[field]
    }));
  };

  render() {
    const { getFieldDecorator } = this.props.form;
    return (
      <Form onSubmit={this.handleSubmit}>
        {/* 用户名 */}
        <FormItem style={formItemStyle}>
          {getFieldDecorator('userName', {
            rules: [
              { required: true, message: '请输入用户名!' },
              { min: 3, message: '用户名至少需要3个字符!' },
              { max: 20, message: '用户名最多20个字符!' }
            ]
          })(
            <Input
              style={changeHeight}
              prefix={<Icon type="user" style={{ fontSize: 13 }} />}
              placeholder="Username (3-20 字符)"
              autoComplete="username"
            />
          )}
        </FormItem>

        {/* Emaiil */}
        <FormItem style={formItemStyle}>
          {getFieldDecorator('email', {
            rules: [
              {
                required: true,
                message: '请输入正确的email!',
                pattern: /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{1,})+$/
              }
            ]
          })(
            <Input
              style={changeHeight}
              prefix={<Icon type="mail" style={{ fontSize: 13 }} />}
              placeholder="Email"
              autoComplete="email"
            />
          )}
        </FormItem>

        {/* 密码 */}
        <FormItem style={formItemStyle}>
          {getFieldDecorator('password', {
            rules: [
              {
                required: true,
                message: '请输入密码!'
              },
              {
                min: 6,
                message: '密码至少需要6个字符!'
              },
              {
                validator: this.checkConfirm
              }
            ]
          })(
            <Input
              style={changeHeight}
              prefix={<Icon type="lock" style={{ fontSize: 13 }} />}
              suffix={
                <Tooltip title={this.state.showPassword ? '隐藏密码' : '显示密码'}>
                  <Icon
                    type={this.state.showPassword ? 'eye-invisible' : 'eye'}
                    onClick={() => this.togglePasswordVisibility('showPassword')}
                    style={{ cursor: 'pointer', color: 'rgba(0,0,0,.45)' }}
                  />
                </Tooltip>
              }
              type={this.state.showPassword ? 'text' : 'password'}
              placeholder="Password (至少6个字符)"
              autoComplete="new-password"
            />
          )}
        </FormItem>

        {/* 密码强度指示 */}
        {this.props.form.getFieldValue('password') && (
          <FormItem style={{ marginBottom: '.1rem' }}>
            <div style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>
              密码强度:
            </div>
            <Progress
              percent={this.state.passwordStrength}
              status={this.getPasswordStrengthStatus()}
              showInfo={false}
              strokeWidth={6}
            />
            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
              建议包含大小写字母、数字和特殊字符
            </div>
          </FormItem>
        )}

        {/* 密码二次确认 */}
        <FormItem style={formItemStyle}>
          {getFieldDecorator('confirm', {
            rules: [
              {
                required: true,
                message: '请再次输入密码!'
              },
              {
                validator: this.checkPassword
              }
            ]
          })(
            <Input
              style={changeHeight}
              prefix={<Icon type="lock" style={{ fontSize: 13 }} />}
              suffix={
                <Tooltip title={this.state.showConfirmPassword ? '隐藏密码' : '显示密码'}>
                  <Icon
                    type={this.state.showConfirmPassword ? 'eye-invisible' : 'eye'}
                    onClick={() => this.togglePasswordVisibility('showConfirmPassword')}
                    style={{ cursor: 'pointer', color: 'rgba(0,0,0,.45)' }}
                  />
                </Tooltip>
              }
              type={this.state.showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              autoComplete="new-password"
            />
          )}
        </FormItem>

        {/* 注册按钮 */}
        <FormItem style={formItemStyle}>
          <Button
            style={changeHeight}
            type="primary"
            htmlType="submit"
            className="login-form-button"
            loading={this.state.loading}
          >
            {this.state.loading ? '注册中...' : '注册'}
          </Button>
        </FormItem>
      </Form>
    );
  }
}
const RegForm = Form.create()(Reg);
export default RegForm;
