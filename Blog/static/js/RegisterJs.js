document.addEventListener('DOMContentLoaded', function () {

    // --- Start of Captcha Logic (Working Version) ---
    const captchaWrapper = document.querySelector('.captcha-wrapper');
    const captchaContainer = document.querySelector('.captcha-container');

    function performCaptchaValidation(captchaInput, hashkeyInput) {
        const response = captchaInput.value.trim();
        const hashkey = hashkeyInput.value;
        if (!response || !hashkey) { return; }
        console.log('正在验证验证码:', response, '使用hashkey:', hashkey);
        if (captchaInput._validating) return;
        captchaInput._validating = true;
        fetch(`{% url 'user:ajax_val' %}?response=${response}&hashkey=${hashkey}`)
            .then(response => response.json())
            .then(data => {
                console.log('验证码验证结果:', data);
                let captchaStatus = document.getElementById('captcha_status');
                if (!captchaStatus && captchaContainer) {
                    captchaStatus = document.createElement('span');
                    captchaStatus.id = 'captcha_status';
                    captchaContainer.appendChild(captchaStatus);
                }
                if (captchaStatus) {
                    captchaStatus.textContent = data.status ? '验证码正确' : (data.message || '验证码错误');
                    captchaStatus.className = data.status ? 'status-success' : 'status-error';
                }
            })
            .catch(error => {
                console.error('验证码验证错误:', error);
                let captchaStatus = document.getElementById('captcha_status');
                if (captchaStatus) { captchaStatus.textContent = '验证出错'; captchaStatus.className = 'status-error'; }
            })
            .finally(() => { captchaInput._validating = false; });
    }

    if (captchaWrapper) {
        captchaWrapper.addEventListener('blur', function (event) {
            if (event.target && event.target.id === 'id_captcha_1') {
                const captchaInput = event.target;
                let hashkeyInput = null;
                const captchaDiv = captchaInput.closest('.captcha');
                if (captchaDiv) { hashkeyInput = captchaDiv.querySelector('input[type="hidden"][name="captcha_0"]'); }
                if (!hashkeyInput) { hashkeyInput = captchaWrapper.querySelector('input[type="hidden"][name="captcha_0"]'); }
                if (captchaInput && hashkeyInput) { performCaptchaValidation(captchaInput, hashkeyInput); }
                else { console.error("无法在 'blur' 事件中找到 hashkey 输入。"); }
            }
        }, true);
        console.log("验证码 'blur' 事件监听器已设置 (委托)。");
    } else { console.error("未能找到 '.captcha-wrapper' 元素来设置事件委托。"); }

    function refreshCaptcha() {
        const refreshButton = document.getElementById('refresh-captcha');
        const icon = refreshButton ? refreshButton.querySelector('i') : null;
        console.log("Attempting to find elements for refresh...");
        const currentCaptchaWrapper = document.querySelector('.captcha-wrapper');
        const captchaImage = currentCaptchaWrapper ? currentCaptchaWrapper.querySelector('img') : null;
        const hashkeyInput = currentCaptchaWrapper ? currentCaptchaWrapper.querySelector('input[type="hidden"][name="captcha_0"]') : null;
        const textInput = currentCaptchaWrapper ? currentCaptchaWrapper.querySelector('input[type="text"][id="id_captcha_1"]') : null;
        console.log("captchaWrapper:", currentCaptchaWrapper, "captchaImage:", captchaImage, "hashkeyInput:", hashkeyInput, "textInput:", textInput);
        if (!currentCaptchaWrapper || !captchaImage || !hashkeyInput || !textInput) {
            if (!currentCaptchaWrapper) console.error("刷新失败: 未找到 .captcha-wrapper");
            if (!captchaImage) console.error("刷新失败: 未找到 img 元素在 .captcha-wrapper 内");
            if (!hashkeyInput) console.error("刷新失败: 未找到 input[name='captcha_0']");
            if (!textInput) console.error("刷新失败: 未找到 input[id='id_captcha_1']");
            console.error("未能找到所有必要的验证码元素。");
            return Promise.reject("Missing captcha elements");
        }
        if (refreshButton) refreshButton.disabled = true;
        if (icon) icon.classList.add('fa-spin');
        const captchaStatus = document.getElementById('captcha_status');
        if (captchaStatus) { captchaStatus.textContent = ''; captchaStatus.className = 'status-text'; }
        return fetch("{% url 'user:refresh_captcha' %}")
            .then(response => response.json())
            .then(data => {
                if (data.status === 1 && data.new_cptch_key && data.new_cptch_image_url) {
                    hashkeyInput.value = data.new_cptch_key;
                    captchaImage.src = data.new_cptch_image_url;
                    textInput.value = '';
                    console.log("验证码已通过更新 src 和 value 刷新。 新 Key:", data.new_cptch_key);
                } else {
                    console.error("刷新请求失败或返回数据无效:", data.message || '未知错误');
                    if (captchaStatus) { captchaStatus.textContent = '刷新失败'; captchaStatus.className = 'status-error'; }
                    throw new Error(data.message || '刷新失败');
                }
            })
            .catch(error => {
                console.error('刷新验证码 fetch 错误:', error);
                if (captchaStatus) { captchaStatus.textContent = '刷新出错'; captchaStatus.className = 'status-error'; }
            })
            .finally(() => {
                if (icon) { setTimeout(() => { icon.classList.remove('fa-spin'); if (refreshButton) refreshButton.disabled = false; }, 300); }
                else { if (refreshButton) refreshButton.disabled = false; }
            });
    }

    const refreshCaptchaBtn = document.getElementById('refresh-captcha');
    if (refreshCaptchaBtn) { refreshCaptchaBtn.addEventListener('click', refreshCaptcha); }
    if (captchaWrapper) {
        captchaWrapper.addEventListener('click', function (event) {
            if (event.target && event.target.tagName === 'IMG' && (event.target.classList.contains('captcha-image') || event.target.closest('.captcha'))) {
                refreshCaptcha();
            }
        });
    }
    // --- End of Captcha Logic ---


    // --- Start of Password Strength Logic (Re-integrated and Checked) ---
    const passwordInput = document.querySelector('input[name="password1"]');
    const confirmPasswordInput = document.querySelector('input[name="password2"]');
    const strengthBar = document.querySelector('.strength-bar');
    const passwordTips = document.querySelector('.password-tips');
    const passwordMessage = document.getElementById('password-message');

    // Tip elements
    const lengthTip = document.getElementById('length-tip');
    const uppercaseTip = document.getElementById('uppercase-tip');
    const lowercaseTip = document.getElementById('lowercase-tip');
    const numberTip = document.getElementById('number-tip');
    const specialTip = document.getElementById('special-tip');

    // Function to update tip item UI
    function updateTipItem(tipElement, isValid) {
        if (!tipElement) return;
        const icon = tipElement.querySelector('i');
        if (isValid) {
            tipElement.classList.add('valid');
            tipElement.classList.remove('invalid');
            icon.className = 'fas fa-check';
        } else {
            tipElement.classList.add('invalid');
            tipElement.classList.remove('valid');
            icon.className = 'fas fa-times';
        }
    }

    // Function to check password criteria and update UI
    function checkPasswordStrength() {
        if (!passwordInput || !strengthBar || !passwordTips) {
            console.warn("Password strength elements not found.");
            return;
        }

        const password = passwordInput.value;
        let score = 0;
        let criteriaMet = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)
        };

        // 更新提示项 UI
        updateTipItem(lengthTip, criteriaMet.length);
        updateTipItem(uppercaseTip, criteriaMet.uppercase);
        updateTipItem(lowercaseTip, criteriaMet.lowercase);
        updateTipItem(numberTip, criteriaMet.number);
        updateTipItem(specialTip, criteriaMet.special);

        // 计算分数
        if (criteriaMet.length) score++;
        if (criteriaMet.uppercase) score++;
        if (criteriaMet.lowercase) score++;
        if (criteriaMet.number) score++;
        if (criteriaMet.special) score++;

        // 更新强度条
        const strengthPercentage = (score / 5) * 100;
        strengthBar.style.width = strengthPercentage + '%';

        if (score <= 1) {
            strengthBar.style.backgroundColor = '#ff4d4d'; // 弱 (红色)
        } else if (score <= 3) {
            strengthBar.style.backgroundColor = '#ffa500'; // 中 (橙色)
        } else if (score === 4) {
            strengthBar.style.backgroundColor = '#ffd700'; // 良好 (黄色)
        } else {
            strengthBar.style.backgroundColor = '#4caf50'; // 强 (绿色)
        }

        // 显示/隐藏提示
        if (password.length > 0) {
            passwordTips.style.display = 'block';
        } else {
            passwordTips.style.display = 'none';
        }
    }

    // Function to check if passwords match
    function checkPasswordMatch() {
        if (!passwordInput || !confirmPasswordInput || !passwordMessage) {
            console.warn("Password confirmation elements not found.");
            return; // Exit if elements are missing
        }
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (confirmPassword.length === 0) {
            passwordMessage.textContent = '';
            passwordMessage.className = 'password-message'; // Reset class
            confirmPasswordInput.style.borderColor = ''; // Reset border
        } else if (password === confirmPassword) {
            passwordMessage.textContent = '密码匹配';
            passwordMessage.className = 'password-message success';
            confirmInput.style.borderColor = '#4caf50'; // Green border
        } else {
            passwordMessage.textContent = '密码不匹配';
            passwordMessage.className = 'password-message error';
            confirmPasswordInput.style.borderColor = '#ff4d4d'; // Red border
        }
    }

    // Add event listeners if elements exist
    if (passwordInput) {
        passwordInput.addEventListener('input', checkPasswordStrength);
        passwordInput.addEventListener('input', checkPasswordMatch);
        passwordInput.addEventListener('focus', () => {
            if (passwordInput.value.length > 0) {
                passwordTips.style.display = 'block';
            }
        });
        passwordInput.addEventListener('blur', () => {
            if (passwordInput.value.length === 0) {
                passwordTips.style.display = 'none';
            }
        });
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    }
    // --- End of Password Strength Logic ---


    // --- Other JS (Username/Email validation, Form submission prevention) ---
    // Username validation (Example - keep if needed)
    const usernameInput = document.querySelector('input[name="username"]');
    const usernameTips = document.getElementById('username-tips');
    const usernameLengthTip = document.getElementById('username-length-tip');
    const usernameCharsTip = document.getElementById('username-chars-tip');
    const usernameEmptyTip = document.getElementById('username-empty-tip'); // 新增空值提示元素

    if (usernameInput && usernameTips && usernameLengthTip && usernameCharsTip && usernameEmptyTip) {
        usernameInput.addEventListener('input', function () {
            const username = this.value;
            let showTips = false;

            // 空值检查
            if (!username || username.trim() === '') {
                usernameEmptyTip.style.display = 'flex';
                showTips = true;
            } else {
                usernameEmptyTip.style.display = 'none';

                // 长度检查 - 2-150字符
                if (username.length < 2 || username.length > 150) {
                    usernameLengthTip.textContent = username.length < 2 ?
                        '用户名长度不能少于2个字符' : '用户名长度不能超过150个字符';
                    usernameLengthTip.style.display = 'flex';
                    showTips = true;
                } else {
                    usernameLengthTip.style.display = 'none';
                }

                // 字符检查 - 只允许字母、数字和下划线
                if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                    usernameCharsTip.style.display = 'flex';
                    showTips = true;
                } else {
                    usernameCharsTip.style.display = 'none';
                }
            }

            usernameTips.style.display = showTips ? 'block' : 'none';
        });

        // 失去焦点时检查空值
        usernameInput.addEventListener('blur', function () {
            if (!this.value || this.value.trim() === '') {
                usernameEmptyTip.style.display = 'flex';
                usernameTips.style.display = 'block';
            }
        });
    }

    // Email validation (Example - keep if needed)
    const emailInput = document.querySelector('input[name="email"]');
    const emailTips = document.getElementById('email-tips');
    const emailFormatTip = document.getElementById('email-format-tip');
    const emailEmptyTip = document.getElementById('email-empty-tip'); // 新增空值提示元素

    if (emailInput && emailTips && emailFormatTip && emailEmptyTip) {
        emailInput.addEventListener('input', function () {
            const email = this.value;
            let showTips = false;

            // 空值检查
            if (!email || email.trim() === '') {
                emailEmptyTip.style.display = 'flex';
                showTips = true;
            } else {
                emailEmptyTip.style.display = 'none';

                // 格式检查
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    emailFormatTip.style.display = 'flex';
                    showTips = true;
                } else {
                    emailFormatTip.style.display = 'none';
                }
            }

            emailTips.style.display = showTips ? 'block' : 'none';
        });

        // 失去焦点时检查空值
        emailInput.addEventListener('blur', function () {
            if (!this.value || this.value.trim() === '') {
                emailEmptyTip.style.display = 'flex';
                emailTips.style.display = 'block';
            }
        });
    }

    // 修改表单提交验证逻辑
    const registerForm = document.querySelector('.sign-up-form');
    if (registerForm) {
        console.log("--- 开始前端注册验证 ---"); // 添加日志

        let hasErrors = false;
        let errorMessages = [];
        let firstErrorField = null; // 用于聚焦

        // --- 清除之前的提示状态 ---
        document.querySelectorAll('.field-tips').forEach(tip => tip.style.display = 'none');
        document.querySelectorAll('.field-tip-item').forEach(item => item.style.display = 'none');
        if (passwordMessage) passwordMessage.textContent = '';

        // 1. 验证用户名
        const username = usernameInput ? usernameInput.value.trim() : '';
        if (!username) {
            hasErrors = true; errorMessages.push('请输入用户名');
            if (usernameEmptyTip) usernameEmptyTip.style.display = 'flex';
            if (!firstErrorField) firstErrorField = usernameInput;
        } else if (username.length < 2 || username.length > 150) {
            hasErrors = true; errorMessages.push('用户名长度应为2-150个字符');
            if (usernameLengthTip) usernameLengthTip.style.display = 'flex';
            if (!firstErrorField) firstErrorField = usernameInput;
        } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            hasErrors = true; errorMessages.push('用户名只能包含字母、数字和下划线');
            if (usernameCharsTip) usernameCharsTip.style.display = 'flex';
            if (!firstErrorField) firstErrorField = usernameInput;
        }
        if (hasErrors && usernameTips) usernameTips.style.display = 'block'; // 显示用户名提示容器

        // 2. 验证邮箱
        const email = emailInput ? emailInput.value.trim() : '';
        let emailHasError = false;
        if (!email) {
            hasErrors = true; emailHasError = true; errorMessages.push('请输入电子邮箱');
            if (emailEmptyTip) emailEmptyTip.style.display = 'flex';
            if (!firstErrorField) firstErrorField = emailInput;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            hasErrors = true; emailHasError = true; errorMessages.push('请输入有效的电子邮箱地址');
            if (emailFormatTip) emailFormatTip.style.display = 'flex';
            if (!firstErrorField) firstErrorField = emailInput;
        }
        if (emailHasError && emailTips) emailTips.style.display = 'block'; // 显示邮箱提示容器


        // 3. 验证密码
        const password = passwordInput ? passwordInput.value : '';
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
        let passwordHasError = false;
        let strengthIssues = []; // 重置

        if (!password) {
            hasErrors = true; passwordHasError = true; errorMessages.push('请输入密码');
            if (!firstErrorField) firstErrorField = passwordInput;
        } else {
            // 检查密码强度
            if (password.length < 8) strengthIssues.push('密码长度至少为8个字符');
            if (!/[A-Z]/.test(password)) strengthIssues.push('密码需包含大写字母');
            if (!/[a-z]/.test(password)) strengthIssues.push('密码需包含小写字母');
            if (!/[0-9]/.test(password)) strengthIssues.push('密码需包含数字');
            if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)) strengthIssues.push('密码需包含特殊字符');

            if (strengthIssues.length > 0) {
                hasErrors = true; passwordHasError = true;
                errorMessages.push('密码强度不足: ' + strengthIssues.join(', '));
                if (!firstErrorField) firstErrorField = passwordInput;
            }
        }
        if (passwordHasError && passwordTips) passwordTips.style.display = 'block'; // 显示密码提示容器


        // 检查密码匹配
        let confirmPasswordHasError = false;
        if (password !== confirmPassword) {
            hasErrors = true; confirmPasswordHasError = true;
            errorMessages.push('两次输入的密码不匹配');
            if (passwordMessage) {
                passwordMessage.textContent = '密码不匹配';
                passwordMessage.className = 'password-message error';
            }
            if (!firstErrorField) firstErrorField = confirmPasswordInput;
        } else if (confirmPassword && password) { // 只有在两个都有值且匹配时才显示成功
            if (passwordMessage) {
                passwordMessage.textContent = '密码匹配';
                passwordMessage.className = 'password-message success';
            }
        }


        // 4. 验证验证码 (仅检查前端状态)
        const captchaStatus = document.getElementById('captcha_status');
        const captchaInput = document.getElementById('id_captcha_1');
        let captchaHasError = false;
        if (!captchaInput || !captchaInput.value.trim()) {
            hasErrors = true; captchaHasError = true;
            errorMessages.push('请输入验证码');
            if (captchaStatus) {
                captchaStatus.textContent = '请输入验证码';
                captchaStatus.className = 'status-error';
            }
            if (!firstErrorField) firstErrorField = captchaInput;
        } else if (captchaStatus && captchaStatus.classList.contains('status-error')) {
            const errorText = captchaStatus.textContent;
            // 只有当错误不是 "请输入验证码" 时才认为是真正的验证错误
            if (errorText && !errorText.includes('请输入验证码')) {
                hasErrors = true; captchaHasError = true;
                errorMessages.push('验证码错误或无效');
                if (!firstErrorField) firstErrorField = captchaInput;
            }
        }
        // 注意：如果验证码状态是 'status-success'，我们假设它是正确的

        // --- 输出结果到控制台 ---
        if (hasErrors) {
            // e.preventDefault(); // 已在开头阻止
            console.error("--- 注册前端验证失败 ---");
            console.warn("错误详情:", errorMessages);

            // 创建错误提示 (可选，可以用 console 替代 alert)
            // let errorSummary = '注册信息有误，请检查以下问题：\n• ' + errorMessages.join('\n• ');
            // alert(errorSummary); // --- 移除 alert ---

            // 聚焦到第一个有问题的输入框
            if (firstErrorField) {
                firstErrorField.focus();
            }
        } else {
            // --- 模拟注册成功 ---
            console.log("--- 注册前端验证通过 ---");
            console.log("模拟注册成功！");
            // 可以选择性地输出表单数据
            const formData = new FormData(registerForm);
            const data = {};
            formData.forEach((value, key) => {
                // 不记录密码和验证码到日志
                if (key !== 'password' && key !== 'confirm_password' && key !== 'captcha_1') {
                    data[key] = value;
                }
            });
            console.log("模拟提交的数据 (部分):", data);
            // alert("模拟注册成功！请查看控制台获取详情。"); // --- 移除 alert ---
        }
    }
    // --- End of Other JS ---

});